package io.fieldiq.api.query;

import io.fieldiq.api.domain.AlertSeverity;
import io.fieldiq.api.domain.Metric;
import io.fieldiq.api.domain.SensorStatus;
import io.fieldiq.api.domain.SensorType;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.List;

/** Read models returned by {@link SensorQueryService}, shared by REST and GraphQL. */
public final class Views {

  private Views() {}

  @Schema(name = "Coordinates")
  public record Coordinates(
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) double lat,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) double lon) {}

  public record SensorView(
      String id,
      String name,
      SensorType type,
      SensorStatus status,
      Coordinates location,
      String municipality,
      String region,
      String siteId,
      String siteName,
      Instant installedAt,
      int batteryPct,
      String firmware,
      Instant lastSeenAt) {}

  @Schema(name = "Reading")
  public record ReadingView(
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String sensorId,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant ts,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Metric metric,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) double value,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String unit) {}

  public record SiteView(
      String id,
      String name,
      String municipality,
      String region,
      Coordinates location,
      int sensorCount) {}

  public record AlertView(
      String id,
      String sensorId,
      String sensorName,
      AlertSeverity severity,
      String message,
      Instant createdAt,
      Instant resolvedAt) {}

  public record StatusCount(SensorStatus status, int count) {}

  public record TypeCount(SensorType type, int count) {}

  public record MetricAverage(Metric metric, Double average, String unit, int sampleSize) {}

  public record SensorStats(
      int total,
      List<StatusCount> byStatus,
      List<TypeCount> byType,
      List<MetricAverage> averages,
      int activeAlerts,
      int regionsCovered) {}

  public record RegionSummary(String region, int sensorCount, int onlineCount, int alertCount) {}

  /** Flat row used for GeoJSON features and CSV export. */
  public record FeatureRow(
      String id,
      String name,
      SensorType type,
      SensorStatus status,
      double lon,
      double lat,
      String municipality,
      String region,
      String siteName,
      int batteryPct,
      String firmware,
      Instant lastSeenAt,
      Metric metric,
      Double value,
      Double pm25) {}

  public record SensorPage(List<SensorView> items, boolean hasNextPage, int totalCount) {}
}
