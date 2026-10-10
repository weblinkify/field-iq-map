package io.fieldiq.api.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.fieldiq.api.domain.ReadingModel.SensorProfile;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;

/**
 * The Java model must reproduce the TypeScript model's golden samples (mock/real parity).
 * Regenerate with {@code cd services/mock-api && npm run golden}.
 */
class ReadingModelGoldenTest {

  @Test
  void matchesTypeScriptGoldenSamples() throws Exception {
    Path golden =
        Path.of(System.getProperty("fieldiq.shared.dir", "../../shared"))
            .resolve("fixtures/readings-golden.json");
    JsonNode samples = new ObjectMapper().readTree(golden.toFile());
    assertThat(samples.size()).isGreaterThan(100);
    for (JsonNode s : samples) {
      SensorProfile profile =
          new SensorProfile(
              s.get("sensorId").asText(),
              s.get("lat").asDouble(),
              s.get("municipality").asText(),
              SensorStatus.valueOf(s.get("status").asText()));
      double value =
          ReadingModel.value(
              profile, Metric.valueOf(s.get("metric").asText()), s.get("epochSecond").asLong());
      // Same formula; allow one rounding step for last-ulp differences in sin/exp.
      assertThat(value).as(s.toString()).isCloseTo(s.get("value").asDouble(), within(0.1001));
    }
  }
}
