package io.fieldiq.api.simulator;

import static org.assertj.core.api.Assertions.assertThat;

import io.fieldiq.api.IntegrationTest;
import io.fieldiq.api.seed.SeedService;
import io.fieldiq.api.simulator.ReadingSimulator.TickResult;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

@IntegrationTest
class ReadingSimulatorIntegrationTest {

  @Autowired ReadingSimulator simulator;
  @Autowired SeedService seedService;
  @Autowired JdbcTemplate jdbc;

  @AfterEach
  void reseed() {
    seedService.seed(24);
    simulator.reset();
  }

  @Test
  void tickRefreshesReportingSensorsOnly() {
    Instant at = Instant.now().truncatedTo(ChronoUnit.SECONDS).plusSeconds(5);
    Timestamp offlineBefore = lastSeenOfFirst("OFFLINE");

    TickResult result = simulator.tick(at);

    assertThat(result.sensors()).isEqualTo(3800);
    assertThat(result.latestReadings())
        .isEqualTo(
            jdbc.queryForObject(
                "SELECT sum(CASE WHEN type = 'MULTI' THEN 4 ELSE 1 END) FROM sensor"
                    + " WHERE status <> 'OFFLINE'",
                Integer.class));
    assertThat(lastSeenOfFirst("ONLINE").toInstant()).isEqualTo(at);
    assertThat(lastSeenOfFirst("OFFLINE")).isEqualTo(offlineBefore);
    assertThat(
            jdbc.queryForObject(
                "SELECT count(*) FROM latest_reading WHERE ts = ?",
                Integer.class,
                Timestamp.from(at)))
        .isEqualTo(result.latestReadings());
    // Same hour as the seeded history: nothing appended.
    assertThat(result.historyRows()).isZero();
  }

  @Test
  void appendsHistoryOncePerNewHourAndPrunesOldRows() {
    Instant nextHour = Instant.now().truncatedTo(ChronoUnit.HOURS).plus(1, ChronoUnit.HOURS);
    jdbc.update(
        "INSERT INTO reading (sensor_id, ts, metric, value, unit)"
            + " VALUES ('FIQ-00001', ?, 'TEMPERATURE', 1, '°C')",
        Timestamp.from(nextHour.minus(30, ChronoUnit.DAYS)));

    TickResult first = simulator.tick(nextHour.plusSeconds(10));
    TickResult second = simulator.tick(nextHour.plusSeconds(40));

    assertThat(first.historyRows()).isEqualTo(first.latestReadings());
    assertThat(first.pruned()).isEqualTo(1);
    assertThat(second.historyRows()).isZero();
    assertThat(
            jdbc.queryForObject(
                "SELECT count(*) FROM reading WHERE ts = ?",
                Integer.class,
                Timestamp.from(nextHour)))
        .isEqualTo(first.latestReadings());
  }

  private Timestamp lastSeenOfFirst(String status) {
    return jdbc.queryForObject(
        "SELECT last_seen_at FROM sensor WHERE status = ? ORDER BY id LIMIT 1",
        Timestamp.class,
        status);
  }
}
