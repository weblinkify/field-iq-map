package io.fieldiq.api.simulator;

import io.fieldiq.api.domain.Metric;
import io.fieldiq.api.domain.ReadingModel;
import io.fieldiq.api.domain.ReadingModel.SensorProfile;
import io.fieldiq.api.domain.SensorStatus;
import io.fieldiq.api.domain.SensorType;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Real-mode simulator: refreshes the latest reading of every reporting sensor (all but OFFLINE),
 * bumps {@code last_seen_at}, appends one hourly history row per metric when a new hour starts and
 * prunes history older than the retention window.
 */
@Component
public class ReadingSimulator {

  static final Duration RETENTION = Duration.ofDays(7);
  private static final Logger log = LoggerFactory.getLogger(ReadingSimulator.class);

  private final JdbcTemplate jdbc;
  private Instant lastHistoryHour;

  public ReadingSimulator(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  /** Outcome of one tick, used by tests and logging. */
  public record TickResult(int sensors, int latestReadings, int historyRows, int pruned) {}

  private record Sample(String sensorId, Metric metric, double value) {}

  @Transactional
  public synchronized TickResult tick(Instant at) {
    Instant now = at.truncatedTo(ChronoUnit.SECONDS);
    List<Sample> samples = new ArrayList<>();
    List<String[]> rows =
        jdbc.query(
            "SELECT id, type, status, ST_Y(location) AS lat, municipality FROM sensor"
                + " WHERE status <> 'OFFLINE' ORDER BY id",
            (rs, i) ->
                new String[] {
                  rs.getString("id"),
                  rs.getString("type"),
                  rs.getString("status"),
                  Double.toString(rs.getDouble("lat")),
                  rs.getString("municipality")
                });
    for (String[] r : rows) {
      SensorProfile profile =
          new SensorProfile(r[0], Double.parseDouble(r[3]), r[4], SensorStatus.valueOf(r[2]));
      for (Metric m : SensorType.valueOf(r[1]).metrics()) {
        samples.add(new Sample(r[0], m, ReadingModel.value(profile, m, now.getEpochSecond())));
      }
    }

    Timestamp ts = Timestamp.from(now);
    jdbc.batchUpdate(
        "INSERT INTO latest_reading (sensor_id, metric, ts, value, unit) VALUES (?, ?, ?, ?, ?)"
            + " ON CONFLICT (sensor_id, metric) DO UPDATE SET ts = EXCLUDED.ts, value = EXCLUDED.value",
        samples,
        1000,
        (ps, s) -> {
          ps.setString(1, s.sensorId());
          ps.setString(2, s.metric().name());
          ps.setTimestamp(3, ts);
          ps.setDouble(4, s.value());
          ps.setString(5, s.metric().unit());
        });
    jdbc.update("UPDATE sensor SET last_seen_at = ? WHERE status <> 'OFFLINE'", ts);

    int history = 0;
    Instant hour = now.truncatedTo(ChronoUnit.HOURS);
    if (lastHistoryHour == null) {
      Timestamp max = jdbc.queryForObject("SELECT max(ts) FROM reading", Timestamp.class);
      lastHistoryHour = max == null ? null : max.toInstant();
    }
    if (lastHistoryHour != null && hour.isAfter(lastHistoryHour)) {
      Timestamp hourTs = Timestamp.from(hour);
      jdbc.batchUpdate(
          "INSERT INTO reading (sensor_id, ts, metric, value, unit) VALUES (?, ?, ?, ?, ?)",
          samples,
          1000,
          (ps, s) -> {
            ps.setString(1, s.sensorId());
            ps.setTimestamp(2, hourTs);
            ps.setString(3, s.metric().name());
            ps.setDouble(4, s.value());
            ps.setString(5, s.metric().unit());
          });
      lastHistoryHour = hour;
      history = samples.size();
    }
    int pruned =
        jdbc.update("DELETE FROM reading WHERE ts < ?", Timestamp.from(now.minus(RETENTION)));

    TickResult result = new TickResult(rows.size(), samples.size(), history, pruned);
    log.debug("Simulator tick at {}: {}", now, result);
    return result;
  }

  /** Forget the cached history hour (after a re-seed). */
  public synchronized void reset() {
    lastHistoryHour = null;
  }
}
