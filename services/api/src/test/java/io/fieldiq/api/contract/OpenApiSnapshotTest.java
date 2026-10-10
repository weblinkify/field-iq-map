package io.fieldiq.api.contract;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import io.fieldiq.api.IntegrationTest;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;

/** The committed shared/openapi/openapi.yaml must equal what springdoc generates. */
@IntegrationTest
class OpenApiSnapshotTest {

  @Autowired MockMvc mvc;

  @Test
  void openApiSpecIsUpToDate() throws Exception {
    String yaml =
        mvc.perform(get("/v3/api-docs.yaml"))
            .andReturn()
            .getResponse()
            .getContentAsString(StandardCharsets.UTF_8);
    ContractSnapshots.assertMatches(
        ContractSnapshots.sharedDir().resolve("openapi/openapi.yaml"),
        yaml,
        "run `make contract-snapshots` and commit the result");
  }
}
