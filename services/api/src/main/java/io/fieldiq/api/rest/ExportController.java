package io.fieldiq.api.rest;

import io.fieldiq.api.domain.SensorStatus;
import io.fieldiq.api.domain.SensorType;
import io.fieldiq.api.query.BBox;
import io.fieldiq.api.query.SensorCriteria;
import io.fieldiq.api.query.SensorQueryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/export")
@Tag(name = "export")
public class ExportController {

  static final String TEXT_CSV = "text/csv;charset=UTF-8";

  private final SensorQueryService service;

  public ExportController(SensorQueryService service) {
    this.service = service;
  }

  @GetMapping(value = "/sensors.csv", produces = TEXT_CSV)
  @Operation(
      operationId = "exportSensorsCsv",
      summary = "Export sensors (optionally in a bbox) as CSV")
  @ApiResponse(responseCode = "200", description = "CSV file")
  @ApiResponse(
      responseCode = "400",
      description = "Invalid request",
      content =
          @Content(
              mediaType = "application/problem+json",
              schema = @Schema(implementation = ProblemDetail.class)))
  public ResponseEntity<String> csv(
      @Parameter(description = "minLon,minLat,maxLon,maxLat (WGS84)")
          @RequestParam(required = false)
          String bbox,
      @RequestParam(name = "type", required = false) List<SensorType> types,
      @RequestParam(name = "status", required = false) List<SensorStatus> statuses,
      @RequestParam(name = "region", required = false) List<String> regions) {
    String body =
        CsvWriter.write(
            service.features(SensorCriteria.of(BBox.parse(bbox), types, statuses, regions, null)));
    return ResponseEntity.ok()
        .header(
            HttpHeaders.CONTENT_DISPOSITION,
            ContentDisposition.attachment().filename("fieldiq-sensors.csv").build().toString())
        .header(HttpHeaders.CONTENT_TYPE, TEXT_CSV)
        .body(body);
  }
}
