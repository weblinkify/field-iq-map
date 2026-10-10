package io.fieldiq.api.rest;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.Instant;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
@Tag(name = "health")
public class HealthController {

  /** Liveness response shared by the real and mock API. */
  public record HealthResponse(String status, String mode, String version, Instant time) {}

  @GetMapping("/health")
  @Operation(operationId = "getHealth", summary = "Service health")
  public HealthResponse health() {
    return new HealthResponse("UP", "live", "2.0.0", Instant.now());
  }
}
