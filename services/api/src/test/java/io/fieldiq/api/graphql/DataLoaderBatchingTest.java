package io.fieldiq.api.graphql;

import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import io.fieldiq.api.IntegrationTest;
import io.fieldiq.api.query.SensorQueryRepository;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.graphql.test.tester.GraphQlTester;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

/** A page of 200 sensors with nested fields must not trigger 1 + N queries. */
@IntegrationTest
class DataLoaderBatchingTest {

  @Autowired GraphQlTester graphQl;
  @MockitoSpyBean SensorQueryRepository repository;

  @Test
  void nestedFieldsAreLoadedInOneBatchPerField() {
    graphQl
        .document(
            "{ sensors(first: 200) { edges { node { id site { id } latestReadings { value }"
                + " alerts(activeOnly: true) { id } } } } }")
        .execute()
        .path("sensors.edges")
        .entityList(Map.class)
        .hasSize(200);

    verify(repository, times(1)).sitesByIds(anyCollection());
    verify(repository, times(1)).latestReadings(anyCollection());
    verify(repository, times(1)).alertsBySensor(anyCollection());
  }
}
