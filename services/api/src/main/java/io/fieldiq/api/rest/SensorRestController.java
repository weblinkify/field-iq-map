package io.fieldiq.api.rest;

import io.fieldiq.api.domain.Metric;
import io.fieldiq.api.domain.SensorStatus;
import io.fieldiq.api.domain.SensorType;
import io.fieldiq.api.query.BBox;
import io.fieldiq.api.query.SensorCriteria;
import io.fieldiq.api.query.SensorQueryService;
import io.fieldiq.api.query.Views.ReadingView;
import io.fieldiq.api.query.Views.SensorView;
import io.fieldiq.api.rest.GeoJson.SensorFeatureCollection;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.Instant;
import java.util.List;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Bulk map data and sensor details. The map loads all points through one cacheable GeoJSON request;
 * detail and aggregate queries go through GraphQL.
 */
@RestController
@RequestMapping("/api/v1")
@Tag(name = "sensors")
public class SensorRestController {

  static final String GEO_JSON = "application/geo+json";

  private final SensorQueryService service;

  public SensorRestController(SensorQueryService service) {
    this.service = service;
  }

  @GetMapping(value = "/sensors.geojson", produces = GEO_JSON)
  @Operation(
      operationId = "getSensorsGeoJson",
      summary = "All sensors as a GeoJSON FeatureCollection with lightweight properties")
  @ApiResponse(
      responseCode = "200",
      description = "GeoJSON FeatureCollection",
      content =
          @Content(
              mediaType = GEO_JSON,
              schema = @Schema(implementation = SensorFeatureCollection.class)))
  @ApiResponse(
      responseCode = "400",
      description = "Invalid request",
      content =
          @Content(
              mediaType = "application/problem+json",
              schema = @Schema(implementation = ProblemDetail.class)))
  public SensorFeatureCollection geojson(
      @Parameter(
              description = "minLon,minLat,maxLon,maxLat (WGS84)",
              example = "24.5,60.1,25.3,60.4")
          @RequestParam(required = false)
          String bbox,
      @RequestParam(name = "type", required = false) List<SensorType> types,
      @RequestParam(name = "status", required = false) List<SensorStatus> statuses,
      @RequestParam(name = "region", required = false) List<String> regions) {
    return SensorFeatureCollection.of(
        service.features(SensorCriteria.of(BBox.parse(bbox), types, statuses, regions, null)));
  }

  @GetMapping(value = "/sensors/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
  @Operation(operationId = "getSensor", summary = "Sensor details with latest readings")
  @ApiResponse(responseCode = "200", description = "Sensor details")
  @ApiResponse(
      responseCode = "404",
      description = "Unknown sensor",
      content =
          @Content(
              mediaType = "application/problem+json",
              schema = @Schema(implementation = ProblemDetail.class)))
  public SensorDetail sensor(@PathVariable @Parameter(example = "FIQ-00042") String id) {
    SensorView s = service.requireSensor(id);
    return SensorDetail.of(s, service.latestReadings(List.of(id)).getOrDefault(id, List.of()));
  }

  @GetMapping(value = "/sensors/{id}/readings", produces = MediaType.APPLICATION_JSON_VALUE)
  @Operation(
      operationId = "getSensorReadings",
      summary = "Hourly readings (defaults to the last 24 hours, all metrics)")
  @ApiResponse(responseCode = "200", description = "Readings ordered by time")
  @ApiResponse(
      responseCode = "400",
      description = "Invalid range",
      content =
          @Content(
              mediaType = "application/problem+json",
              schema = @Schema(implementation = ProblemDetail.class)))
  @ApiResponse(
      responseCode = "404",
      description = "Unknown sensor",
      content =
          @Content(
              mediaType = "application/problem+json",
              schema = @Schema(implementation = ProblemDetail.class)))
  public List<ReadingView> readings(
      @PathVariable String id,
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
          Instant from,
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
          Instant to,
      @RequestParam(required = false) Metric metric) {
    service.requireSensor(id);
    return service.readings(id, from, to, metric);
  }
}
