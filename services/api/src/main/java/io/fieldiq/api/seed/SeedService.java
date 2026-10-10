package io.fieldiq.api.seed;

import io.fieldiq.api.domain.Metric;
import io.fieldiq.api.domain.ReadingModel;
import io.fieldiq.api.domain.ReadingModel.SensorProfile;
import io.fieldiq.api.seed.Fixture.FixtureAlert;
import io.fieldiq.api.seed.Fixture.FixtureSensor;
import java.io.IOException;
import java.io.StringReader;
import java.io.UncheckedIOException;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import javax.sql.DataSource;
import org.postgresql.PGConnection;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Seeds PostGIS from {@code shared/fixtures/sensors.json}: sites, sensors, alerts, hourly history
 * and the latest reading per metric. Fixture times are relative ("seconds ago") and anchored at the
 * moment of seeding.
 */
@Service
public class SeedService {

  private static final Logger log = LoggerFactory.getLogger(SeedService.class);

  private final JdbcTemplate jdbc;
  private final DataSource dataSource;
  private final FixtureLoader loader;
  private final Clock clock;

  public SeedService(JdbcTemplate jdbc, DataSource dataSource, FixtureLoader loader, Clock clock) {
    this.jdbc = jdbc;
    this.dataSource = dataSource;
    this.loader = loader;
    this.clock = clock;
  }

  public long sensorCount() {
    Long n = jdbc.queryForObject("SELECT count(*) FROM sensor", Long.class);
    return n == null ? 0 : n;
  }

  /** Replaces all data with the fixture. Returns the number of sensors written. */
  @Transactional
  public int seed(int historyHours) {
    long started = System.nanoTime();
    Fixture fixture = loader.load();
    Instant now = clock.instant().truncatedTo(ChronoUnit.SECONDS);

    jdbc.execute("TRUNCATE reading, latest_reading, alert, sensor, site");

    jdbc.batchUpdate(
        "INSERT INTO site (id, name, municipality, region, location)"
            + " VALUES (?, ?, ?, ?, ST_SetSRID(ST_MakePoint(?, ?), 4326))",
        fixture.sites(),
        500,
        (ps, s) -> {
          ps.setString(1, s.id());
          ps.setString(2, s.name());
          ps.setString(3, s.municipality());
          ps.setString(4, s.region());
          ps.setDouble(5, s.lon());
          ps.setDouble(6, s.lat());
        });

    jdbc.batchUpdate(
        "INSERT INTO sensor (id, name, type, status, location, municipality, region, site_id,"
            + " site_name, installed_at, battery_pct, firmware, last_seen_at)"
            + " VALUES (?, ?, ?, ?, ST_SetSRID(ST_MakePoint(?, ?), 4326), ?, ?, ?, ?, ?, ?, ?, ?)",
        fixture.sensors(),
        1000,
        (ps, s) -> {
          ps.setString(1, s.id());
          ps.setString(2, s.name());
          ps.setString(3, s.type().name());
          ps.setString(4, s.status().name());
          ps.setDouble(5, s.lon());
          ps.setDouble(6, s.lat());
          ps.setString(7, s.municipality());
          ps.setString(8, s.region());
          ps.setString(9, s.siteId());
          ps.setString(10, s.siteName());
          ps.setTimestamp(11, Timestamp.from(s.installedAt()));
          ps.setInt(12, s.batteryPct());
          ps.setString(13, s.firmware());
          ps.setTimestamp(14, Timestamp.from(lastSeen(s, now)));
        });

    jdbc.batchUpdate(
        "INSERT INTO alert (id, sensor_id, severity, message, created_at, resolved_at)"
            + " VALUES (?, ?, ?, ?, ?, ?)",
        fixture.alerts(),
        1000,
        (ps, a) -> {
          ps.setString(1, a.id());
          ps.setString(2, a.sensorId());
          ps.setString(3, a.severity().name());
          ps.setString(4, a.message());
          ps.setTimestamp(5, Timestamp.from(now.minusSeconds(a.createdSecondsAgo())));
          ps.setTimestamp(6, resolvedAt(a, now));
        });

    StringBuilder history = new StringBuilder(8 << 20);
    StringBuilder latest = new StringBuilder(1 << 20);
    Instant currentHour = now.truncatedTo(ChronoUnit.HOURS);
    for (FixtureSensor s : fixture.sensors()) {
      SensorProfile profile = profile(s);
      Instant seen = lastSeen(s, now);
      for (Metric m : s.type().metrics()) {
        for (int h = historyHours - 1; h >= 0; h--) {
          Instant ts = currentHour.minus(h, ChronoUnit.HOURS);
          if (!ts.isAfter(seen)) {
            appendCsv(history, s.id(), ts, m, ReadingModel.value(profile, m, ts.getEpochSecond()));
          }
        }
        appendCsv(latest, s.id(), seen, m, ReadingModel.value(profile, m, seen.getEpochSecond()));
      }
    }
    copy("COPY reading (sensor_id, ts, metric, value, unit) FROM STDIN WITH (FORMAT csv)", history);
    copy(
        "COPY latest_reading (sensor_id, ts, metric, value, unit) FROM STDIN WITH (FORMAT csv)",
        latest);

    log.info(
        "Seeded {} sensors, {} sites, {} alerts ({} h history) in {} ms",
        fixture.sensors().size(),
        fixture.sites().size(),
        fixture.alerts().size(),
        historyHours,
        (System.nanoTime() - started) / 1_000_000);
    return fixture.sensors().size();
  }

  public static SensorProfile profile(FixtureSensor s) {
    return new SensorProfile(s.id(), s.lat(), s.municipality(), s.status());
  }

  private static Instant lastSeen(FixtureSensor s, Instant now) {
    return now.minusSeconds(s.lastSeenSecondsAgo());
  }

  private static Timestamp resolvedAt(FixtureAlert a, Instant now) {
    return a.resolvedSecondsAgo() == null
        ? null
        : Timestamp.from(now.minusSeconds(a.resolvedSecondsAgo()));
  }

  private static void appendCsv(StringBuilder sb, String id, Instant ts, Metric m, double value) {
    sb.append(id)
        .append(',')
        .append(ts)
        .append(',')
        .append(m.name())
        .append(',')
        .append(value)
        .append(",\"")
        .append(m.unit())
        .append("\"\n");
  }

  private void copy(String sql, CharSequence csv) {
    Connection connection = DataSourceUtils.getConnection(dataSource);
    try {
      connection
          .unwrap(PGConnection.class)
          .getCopyAPI()
          .copyIn(sql, new StringReader(csv.toString()));
    } catch (SQLException e) {
      throw new IllegalStateException("COPY failed: " + sql, e);
    } catch (IOException e) {
      throw new UncheckedIOException(e);
    } finally {
      DataSourceUtils.releaseConnection(connection, dataSource);
    }
  }
}
