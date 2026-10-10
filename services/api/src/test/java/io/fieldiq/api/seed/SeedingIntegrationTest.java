package io.fieldiq.api.seed;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.fieldiq.api.IntegrationTest;
import java.io.InputStream;
import java.sql.ResultSet;
import java.sql.Statement;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;

@IntegrationTest
class SeedingIntegrationTest {

  @Autowired JdbcTemplate jdbc;
  @Autowired ObjectMapper mapper;

  @Test
  void seedsExactly4000Sensors() {
    assertThat(count("SELECT count(*) FROM sensor")).isEqualTo(4000);
    assertThat(count("SELECT count(DISTINCT id) FROM sensor")).isEqualTo(4000);
    assertThat(count("SELECT count(*) FROM site")).isEqualTo(264);
    assertThat(count("SELECT count(*) FROM alert WHERE resolved_at IS NULL")).isEqualTo(600);
  }

  @Test
  void everySensorIsInsideFinland() throws Exception {
    JsonNode geometry;
    try (InputStream in = new ClassPathResource("geo/finland.geojson").getInputStream()) {
      geometry = mapper.readTree(in).path("features").path(0).path("geometry");
    }
    String finland = mapper.writeValueAsString(geometry);
    Integer outside =
        jdbc.queryForObject(
            "SELECT count(*) FROM sensor"
                + " WHERE NOT ST_Within(location, ST_SetSRID(ST_GeomFromGeoJSON(?), 4326))",
            Integer.class,
            finland);
    assertThat(outside).isZero();
  }

  @Test
  void seedsStatusMixAndReadings() {
    assertThat(count("SELECT count(*) FROM sensor WHERE status = 'ONLINE'")).isEqualTo(3400);
    assertThat(count("SELECT count(*) FROM sensor WHERE status = 'ALERT'")).isEqualTo(280);
    assertThat(count("SELECT count(*) FROM sensor WHERE status = 'OFFLINE'")).isEqualTo(200);
    assertThat(count("SELECT count(*) FROM sensor WHERE status = 'LOW_BATTERY'")).isEqualTo(120);
    // One latest reading per measured metric: 4 for MULTI, 1 otherwise.
    assertThat(count("SELECT count(*) FROM latest_reading"))
        .isEqualTo(count("SELECT sum(CASE WHEN type = 'MULTI' THEN 4 ELSE 1 END) FROM sensor"));
    assertThat(count("SELECT count(DISTINCT sensor_id) FROM reading")).isGreaterThan(3800);
    assertThat(count("SELECT count(*) FROM reading WHERE ts > now()")).isZero();
  }

  @Test
  void usesTheSpatialIndexForBoundingBoxes() {
    String plan =
        jdbc.execute(
            (ConnectionCallback<String>)
                connection -> {
                  StringBuilder sb = new StringBuilder();
                  try (Statement st = connection.createStatement()) {
                    st.execute("SET enable_seqscan = off");
                    try (ResultSet rs =
                        st.executeQuery(
                            "EXPLAIN SELECT id FROM sensor WHERE location"
                                + " && ST_MakeEnvelope(24.5, 60.1, 25.3, 60.4, 4326)")) {
                      while (rs.next()) {
                        sb.append(rs.getString(1)).append('\n');
                      }
                    }
                    st.execute("RESET enable_seqscan");
                  }
                  return sb.toString();
                });
    assertThat(plan).contains("sensor_location_gix");
  }

  private long count(String sql) {
    Long n = jdbc.queryForObject(sql, Long.class);
    return n == null ? 0 : n;
  }
}
