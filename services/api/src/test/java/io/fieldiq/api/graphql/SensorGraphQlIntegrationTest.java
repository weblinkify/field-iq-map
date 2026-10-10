package io.fieldiq.api.graphql;

import static org.assertj.core.api.Assertions.assertThat;

import io.fieldiq.api.IntegrationTest;
import io.fieldiq.api.query.BBox;
import io.fieldiq.api.seed.Fixture;
import io.fieldiq.api.seed.FixtureLoader;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.graphql.execution.ErrorType;
import org.springframework.graphql.test.tester.GraphQlTester;

@IntegrationTest
class SensorGraphQlIntegrationTest {

  @Autowired GraphQlTester graphQl;
  @Autowired FixtureLoader fixtureLoader;
  Fixture fixture;

  @BeforeEach
  void loadFixture() {
    fixture = fixtureLoader.load();
  }

  @Test
  void sensorWithNestedFields() {
    Fixture.FixtureSensor expected = fixture.sensors().get(41);
    graphQl
        .document(
            """
            query($id: ID!) {
              sensor(id: $id) {
                id name type status municipality region siteName batteryPct firmware
                lastSeenAt installedAt
                location { lat lon }
                site { id name sensorCount location { lat lon } }
                latestReadings { metric value unit ts }
                readings(metric: null) { ts metric value unit }
                alerts { id severity message createdAt resolvedAt sensorName }
              }
            }
            """)
        .variable("id", "FIQ-00042")
        .execute()
        .path("sensor.id")
        .entity(String.class)
        .isEqualTo("FIQ-00042")
        .path("sensor.name")
        .entity(String.class)
        .isEqualTo(expected.name())
        .path("sensor.site.id")
        .entity(String.class)
        .isEqualTo(expected.siteId())
        .path("sensor.latestReadings")
        .entityList(Map.class)
        .hasSize(expected.type().metrics().size())
        .path("sensor.lastSeenAt")
        .entity(String.class)
        .satisfies(ts -> assertThat(ts).matches("\\d{4}-\\d\\d-\\d\\dT\\d\\d:\\d\\d:\\d\\dZ"));
  }

  @Test
  void unknownSensorIsNull() {
    graphQl
        .document("{ sensor(id: \"FIQ-99999\") { id } }")
        .execute()
        .errors()
        .verify()
        .path("sensor")
        .valueIsNull();
  }

  @Test
  void cursorPaginationWalksEveryMatchExactlyOnce() {
    String filter = "{ statuses: [ALERT] }";
    List<String> seen = new ArrayList<>();
    String after = null;
    boolean hasNext = true;
    int pages = 0;
    while (hasNext) {
      var response =
          graphQl
              .document(
                  "query($after: String) { sensors(filter: "
                      + filter
                      + ", first: 100, after: $after) {"
                      + " totalCount edges { cursor node { id status } }"
                      + " pageInfo { hasNextPage endCursor } } }")
              .variable("after", after)
              .execute();
      List<String> ids = response.path("sensors.edges[*].node.id").entityList(String.class).get();
      seen.addAll(ids);
      response.path("sensors.totalCount").entity(Integer.class).isEqualTo(280);
      hasNext = response.path("sensors.pageInfo.hasNextPage").entity(Boolean.class).get();
      after = response.path("sensors.pageInfo.endCursor").entity(String.class).get();
      pages++;
    }
    assertThat(pages).isEqualTo(3);
    assertThat(seen).hasSize(280).doesNotHaveDuplicates().isSorted();
  }

  @Test
  void paginationValidatesArguments() {
    graphQl
        .document("{ sensors(first: 500) { totalCount } }")
        .execute()
        .errors()
        .expect(e -> e.getErrorType() == ErrorType.BAD_REQUEST)
        .verify();
    graphQl
        .document("{ sensors(after: \"bogus\") { totalCount } }")
        .execute()
        .errors()
        .expect(e -> e.getErrorType() == ErrorType.BAD_REQUEST)
        .verify();
  }

  @Test
  void statsForBboxMatchFixture() {
    BBox box = new BBox(24.70, 60.10, 25.25, 60.35);
    List<Fixture.FixtureSensor> inBox =
        fixture.sensors().stream().filter(s -> box.contains(s.lon(), s.lat())).toList();
    long alerts = inBox.stream().filter(s -> s.status().name().equals("ALERT")).count();
    var response =
        graphQl
            .document(
                """
                {
                  sensorStats(bbox: {minLon: 24.70, minLat: 60.10, maxLon: 25.25, maxLat: 60.35}) {
                    total activeAlerts regionsCovered
                    byStatus { status count }
                    byType { type count }
                    averages { metric average unit sampleSize }
                  }
                }
                """)
            .execute();
    response.path("sensorStats.total").entity(Integer.class).isEqualTo(inBox.size());
    response.path("sensorStats.byStatus").entityList(Map.class).hasSize(4);
    response.path("sensorStats.byType").entityList(Map.class).hasSize(5);
    response.path("sensorStats.averages").entityList(Map.class).hasSize(4);
    response
        .path("sensorStats.byStatus[?(@.status == 'ALERT')].count")
        .entityList(Integer.class)
        .containsExactly((int) alerts);
    response
        .path("sensorStats.averages[?(@.metric == 'TEMPERATURE')].unit")
        .entityList(String.class)
        .containsExactly("°C");
  }

  @Test
  void statsWithFilterAndInvalidBbox() {
    graphQl
        .document("{ sensorStats(filter: { types: [NOISE], regions: [\"Lappi\"] }) { total } }")
        .execute()
        .path("sensorStats.total")
        .entity(Integer.class)
        .isEqualTo(
            (int)
                fixture.sensors().stream()
                    .filter(s -> s.type().name().equals("NOISE") && s.region().equals("Lappi"))
                    .count());
    graphQl
        .document(
            "{ sensorStats(bbox: {minLon: 30, minLat: 60, maxLon: 20, maxLat: 61}) { total } }")
        .execute()
        .errors()
        .expect(e -> e.getErrorType() == ErrorType.BAD_REQUEST)
        .verify();
  }

  @Test
  void searchMatchesIdNameAndMunicipality() {
    graphQl
        .document("{ sensors(filter: { search: \"fiq-00042\" }) { totalCount } }")
        .execute()
        .path("sensors.totalCount")
        .entity(Integer.class)
        .isEqualTo(1);
    graphQl
        .document("{ sensors(filter: { search: \"rovaniemi\" }) { totalCount } }")
        .execute()
        .path("sensors.totalCount")
        .entity(Integer.class)
        .satisfies(n -> assertThat(n).isGreaterThanOrEqualTo(140));
  }

  @Test
  void regionsCoverAllSensors() {
    var response =
        graphQl.document("{ regions { region sensorCount onlineCount alertCount } }").execute();
    List<String> names = response.path("regions[*].region").entityList(String.class).get();
    assertThat(names).hasSize(19).isSorted();
    List<Integer> counts = response.path("regions[*].sensorCount").entityList(Integer.class).get();
    assertThat(counts.stream().mapToInt(Integer::intValue).sum()).isEqualTo(4000);
  }

  @Test
  void sitesAndAlerts() {
    graphQl
        .document("{ sites { id sensorCount } }")
        .execute()
        .path("sites")
        .entityList(Map.class)
        .hasSize(264);
    graphQl
        .document("{ sites(region: \"Ahvenanmaa\") { municipality } }")
        .execute()
        .path("sites[*].municipality")
        .entityList(String.class)
        .satisfies(list -> assertThat(new HashSet<>(list)).isEqualTo(Set.of("Maarianhamina")));
    graphQl
        .document("{ alerts(first: 1000) { id resolvedAt sensorName } }")
        .execute()
        .path("alerts")
        .entityList(Map.class)
        .hasSize(600);
    graphQl
        .document("{ alerts(activeOnly: false, first: 1000) { id } }")
        .execute()
        .path("alerts")
        .entityList(Map.class)
        .hasSize(1000);
  }
}
