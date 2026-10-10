package io.fieldiq.api.rest;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.Instant;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
@Tag(name = "health")
public class HealthController {

  /** Liveness response shared by the real and mock API. */
  @Schema(
      name = "HealthResponse",
      requiredProperties = {"status", "mode", "version", "time"})
  public record HealthResponse(
      String status,
      @Schema(allowableValues = {"live", "mock"}) String mode,
      String version,
      Instant time) {}

  @GetMapping(value = "/health", produces = MediaType.APPLICATION_JSON_VALUE)
  @Operation(operationId = "getHealth", summary = "Service health")
  public HealthResponse health() {
    return new HealthResponse(
        "UP", "live", "2.0.0", Instant.now().truncatedTo(java.time.temporal.ChronoUnit.SECONDS));
  }
}
