package io.fieldiq.api.seed;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import io.fieldiq.api.domain.AlertSeverity;
import io.fieldiq.api.domain.SensorStatus;
import io.fieldiq.api.domain.SensorType;
import java.time.Instant;
import java.util.List;

/** Shape of {@code shared/fixtures/sensors.json}. */
@JsonIgnoreProperties(ignoreUnknown = true)
public record Fixture(
    int version,
    long seed,
    List<FixtureSite> sites,
    List<FixtureSensor> sensors,
    List<FixtureAlert> alerts) {

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record FixtureSite(
      String id, String name, String municipality, String region, double lat, double lon) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record FixtureSensor(
      String id,
      String name,
      SensorType type,
      SensorStatus status,
      double lat,
      double lon,
      String municipality,
      String region,
      String siteId,
      String siteName,
      Instant installedAt,
      int batteryPct,
      String firmware,
      long lastSeenSecondsAgo) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record FixtureAlert(
      String id,
      String sensorId,
      AlertSeverity severity,
      String message,
      long createdSecondsAgo,
      Long resolvedSecondsAgo) {}
}
