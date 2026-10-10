package io.fieldiq.api.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.notNullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.fieldiq.api.IntegrationTest;
import io.fieldiq.api.query.BBox;
import io.fieldiq.api.seed.Fixture;
import io.fieldiq.api.seed.FixtureLoader;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@IntegrationTest
class SensorRestIntegrationTest {

  static final String HELSINKI = "24.70,60.10,25.25,60.35";

  @Autowired MockMvc mvc;
  @Autowired ObjectMapper mapper;
  @Autowired FixtureLoader fixtureLoader;
  Fixture fixture;

  @BeforeEach
  void loadFixture() {
    fixture = fixtureLoader.load();
  }

  @Test
  void geojsonReturnsAll4000Features() throws Exception {
    MvcResult result =
        mvc.perform(get("/api/v1/sensors.geojson"))
            .andExpect(status().isOk())
            .andExpect(header().string(HttpHeaders.CONTENT_TYPE, containsString("geo+json")))
            .andExpect(header().exists(HttpHeaders.ETAG))
            .andExpect(jsonPath("$.type").value("FeatureCollection"))
            .andExpect(jsonPath("$.features", hasSize(4000)))
            .andReturn();
    JsonNode first = mapper.readTree(result.getResponse().getContentAsString()).at("/features/0");
    assertThat(first.at("/id").asText()).isEqualTo("FIQ-00001");
    assertThat(first.at("/geometry/type").asText()).isEqualTo("Point");
    assertThat(first.at("/geometry/coordinates/0").asDouble())
        .isEqualTo(fixture.sensors().getFirst().lon());
    assertThat(first.at("/properties/unit").asText()).isNotBlank();
  }

  @Test
  void geojsonSupportsConditionalRequests() throws Exception {
    String etag =
        mvc.perform(get("/api/v1/sensors.geojson").param("status", "OFFLINE"))
            .andReturn()
            .getResponse()
            .getHeader(HttpHeaders.ETAG);
    mvc.perform(
            get("/api/v1/sensors.geojson")
                .param("status", "OFFLINE")
                .header(HttpHeaders.IF_NONE_MATCH, etag))
        .andExpect(status().isNotModified());
  }

  @ParameterizedTest
  @ValueSource(strings = {HELSINKI, "21.0,60.0,23.0,61.0", "23.0,66.0,30.0,70.1", "19,59,32,71"})
  void bboxCountMatchesInMemoryPointInRectangle(String bbox) throws Exception {
    BBox box = BBox.parse(bbox);
    long expected = fixture.sensors().stream().filter(s -> box.contains(s.lon(), s.lat())).count();
    mvc.perform(get("/api/v1/sensors.geojson").param("bbox", bbox))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.features", hasSize((int) expected)));
    assertThat(expected).isPositive();
  }

  @Test
  void filtersByTypeStatusAndRegion() throws Exception {
    long expected =
        fixture.sensors().stream()
            .filter(s -> s.type().name().equals("NOISE") || s.type().name().equals("MULTI"))
            .filter(s -> s.status().name().equals("ALERT"))
            .filter(s -> s.region().equals("Uusimaa"))
            .count();
    mvc.perform(
            get("/api/v1/sensors.geojson")
                .param("type", "NOISE,MULTI")
                .param("status", "ALERT")
                .param("region", "Uusimaa"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.features", hasSize((int) expected)))
        .andExpect(jsonPath("$.features[*].properties.status", everyItem(is("ALERT"))));
  }

  @ParameterizedTest
  @ValueSource(strings = {"1,2,3", "-200,60,25,61", "25,60,24,61", "24,95,25,96", "x,y,z,w"})
  void invalidBboxIsProblemJson(String bbox) throws Exception {
    mvc.perform(get("/api/v1/sensors.geojson").param("bbox", bbox))
        .andExpect(status().isBadRequest())
        .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
        .andExpect(jsonPath("$.status").value(400))
        .andExpect(jsonPath("$.title").value("Invalid request"))
        .andExpect(jsonPath("$.type").value("https://fieldiq.dev/problems/invalid-request"))
        .andExpect(jsonPath("$.detail", notNullValue()));
  }

  @Test
  void unknownEnumIsBadRequest() throws Exception {
    mvc.perform(get("/api/v1/sensors.geojson").param("status", "BROKEN"))
        .andExpect(status().isBadRequest())
        .andExpect(content().contentTypeCompatibleWith("application/problem+json"));
  }

  @Test
  void sensorDetail() throws Exception {
    Fixture.FixtureSensor s = fixture.sensors().get(41);
    mvc.perform(get("/api/v1/sensors/FIQ-00042"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value("FIQ-00042"))
        .andExpect(jsonPath("$.name").value(s.name()))
        .andExpect(jsonPath("$.location.lat").value(s.lat()))
        .andExpect(jsonPath("$.siteName").value(s.siteName()))
        .andExpect(jsonPath("$.latestReadings", hasSize(s.type().metrics().size())))
        .andExpect(jsonPath("$.lastSeenAt", notNullValue()));
  }

  @Test
  void unknownSensorIs404ProblemJson() throws Exception {
    mvc.perform(get("/api/v1/sensors/FIQ-99999"))
        .andExpect(status().isNotFound())
        .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
        .andExpect(jsonPath("$.title").value("Not found"));
    mvc.perform(get("/api/v1/sensors/FIQ-99999/readings")).andExpect(status().isNotFound());
  }

  @Test
  void readingsDefaultToLast24Hours() throws Exception {
    String id = onlineSingleMetricSensor();
    mvc.perform(get("/api/v1/sensors/" + id + "/readings"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$", hasSize(24)))
        .andExpect(jsonPath("$[0].sensorId").value(id));
  }

  @Test
  void readingsFilterByMetricAndRange() throws Exception {
    String multi =
        fixture.sensors().stream()
            .filter(s -> s.type().name().equals("MULTI") && s.status().name().equals("ONLINE"))
            .findFirst()
            .orElseThrow()
            .id();
    Instant to = Instant.now();
    Instant from = to.minus(6, ChronoUnit.HOURS);
    mvc.perform(
            get("/api/v1/sensors/" + multi + "/readings")
                .param("metric", "PM25")
                .param("from", from.toString())
                .param("to", to.toString()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$", hasSize(6)))
        .andExpect(jsonPath("$[*].metric", everyItem(is("PM25"))))
        .andExpect(jsonPath("$[*].unit", everyItem(is("µg/m³"))));
  }

  @Test
  void invalidReadingRangeIsBadRequest() throws Exception {
    Instant now = Instant.now();
    mvc.perform(
            get("/api/v1/sensors/FIQ-00001/readings")
                .param("from", now.toString())
                .param("to", now.minusSeconds(60).toString()))
        .andExpect(status().isBadRequest());
    mvc.perform(
            get("/api/v1/sensors/FIQ-00001/readings")
                .param("from", now.minus(40, ChronoUnit.DAYS).toString())
                .param("to", now.toString()))
        .andExpect(status().isBadRequest());
  }

  @Test
  void exportsCsvForBbox() throws Exception {
    BBox box = BBox.parse(HELSINKI);
    long expected = fixture.sensors().stream().filter(s -> box.contains(s.lon(), s.lat())).count();
    String csv =
        mvc.perform(get("/api/v1/export/sensors.csv").param("bbox", HELSINKI))
            .andExpect(status().isOk())
            .andExpect(content().contentTypeCompatibleWith("text/csv"))
            .andExpect(
                header()
                    .string(
                        HttpHeaders.CONTENT_DISPOSITION,
                        containsString("attachment; filename=\"fieldiq-sensors.csv\"")))
            .andReturn()
            .getResponse()
            .getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
    String[] lines = csv.split("\r\n");
    assertThat(lines[0]).isEqualTo(CsvWriter.HEADER);
    assertThat(lines).hasSize((int) expected + 1);
  }

  @Test
  void csvRejectsInvalidBbox() throws Exception {
    mvc.perform(get("/api/v1/export/sensors.csv").param("bbox", "1,1,0,0"))
        .andExpect(status().isBadRequest());
  }

  private String onlineSingleMetricSensor() {
    return fixture.sensors().stream()
        .filter(s -> s.type().name().equals("TEMPERATURE") && s.status().name().equals("ONLINE"))
        .findFirst()
        .orElseThrow()
        .id();
  }
}
