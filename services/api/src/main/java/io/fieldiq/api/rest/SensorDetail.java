package io.fieldiq.api.rest;

import io.fieldiq.api.domain.SensorStatus;
import io.fieldiq.api.domain.SensorType;
import io.fieldiq.api.query.Views.Coordinates;
import io.fieldiq.api.query.Views.ReadingView;
import io.fieldiq.api.query.Views.SensorView;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.List;

@Schema(
    name = "SensorDetail",
    requiredProperties = {
      "id",
      "name",
      "type",
      "status",
      "location",
      "municipality",
      "region",
      "siteId",
      "siteName",
      "installedAt",
      "batteryPct",
      "firmware",
      "lastSeenAt",
      "latestReadings"
    })
public record SensorDetail(
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
    Instant lastSeenAt,
    List<ReadingView> latestReadings) {

  static SensorDetail of(SensorView s, List<ReadingView> latest) {
    return new SensorDetail(
        s.id(),
        s.name(),
        s.type(),
        s.status(),
        s.location(),
        s.municipality(),
        s.region(),
        s.siteId(),
        s.siteName(),
        s.installedAt(),
        s.batteryPct(),
        s.firmware(),
        s.lastSeenAt(),
        latest);
  }
}
