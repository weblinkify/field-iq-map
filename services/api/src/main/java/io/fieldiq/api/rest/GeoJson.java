package io.fieldiq.api.rest;

import io.fieldiq.api.domain.Metric;
import io.fieldiq.api.domain.SensorStatus;
import io.fieldiq.api.domain.SensorType;
import io.fieldiq.api.query.Views.FeatureRow;
import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.List;

/** GeoJSON DTOs for the bulk map endpoint (RFC 7946). */
public final class GeoJson {

  private GeoJson() {}

  @Schema(
      name = "SensorFeatureCollection",
      requiredProperties = {"type", "features"})
  public record SensorFeatureCollection(
      @Schema(allowableValues = "FeatureCollection") String type, List<SensorFeature> features) {

    public static SensorFeatureCollection of(List<FeatureRow> rows) {
      return new SensorFeatureCollection(
          "FeatureCollection", rows.stream().map(SensorFeature::of).toList());
    }
  }

  @Schema(
      name = "SensorFeature",
      requiredProperties = {"type", "id", "geometry", "properties"})
  public record SensorFeature(
      @Schema(allowableValues = "Feature") String type,
      String id,
      PointGeometry geometry,
      SensorFeatureProperties properties) {

    static SensorFeature of(FeatureRow r) {
      return new SensorFeature(
          "Feature",
          r.id(),
          new PointGeometry("Point", List.of(r.lon(), r.lat())),
          new SensorFeatureProperties(
              r.id(),
              r.name(),
              r.type(),
              r.status(),
              r.municipality(),
              r.region(),
              r.siteName(),
              r.batteryPct(),
              r.lastSeenAt(),
              r.metric(),
              r.value(),
              r.metric().unit(),
              r.pm25()));
    }
  }

  @Schema(
      name = "PointGeometry",
      requiredProperties = {"type", "coordinates"})
  public record PointGeometry(
      @Schema(allowableValues = "Point") String type,
      @ArraySchema(
              minItems = 2,
              maxItems = 2,
              arraySchema = @Schema(description = "[longitude, latitude]"))
          List<Double> coordinates) {}

  @Schema(
      name = "SensorFeatureProperties",
      requiredProperties = {
        "id",
        "name",
        "type",
        "status",
        "municipality",
        "region",
        "siteName",
        "batteryPct",
        "lastSeenAt",
        "metric",
        "value",
        "unit",
        "pm25"
      })
  public record SensorFeatureProperties(
      String id,
      String name,
      SensorType type,
      SensorStatus status,
      String municipality,
      String region,
      String siteName,
      int batteryPct,
      Instant lastSeenAt,
      @Schema(description = "Primary metric shown on the map") Metric metric,
      @Schema(
              types = {"number", "null"},
              description = "Latest value of the primary metric")
          Double value,
      String unit,
      @Schema(
              types = {"number", "null"},
              description = "Latest PM2.5 (heatmap weight)")
          Double pm25) {}
}
