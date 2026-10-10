package io.fieldiq.api.contract;

import graphql.schema.idl.SchemaPrinter;
import io.fieldiq.api.IntegrationTest;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.graphql.execution.GraphQlSource;

/**
 * Snapshot of the executable schema as served (shared schema + runtime wiring). Fails when the
 * served schema drifts from the committed snapshot without regenerating it.
 */
@IntegrationTest
class GraphQlSchemaSnapshotTest {

  @Autowired GraphQlSource graphQlSource;

  @Test
  void servedSchemaMatchesSnapshot() throws Exception {
    String printed =
        new SchemaPrinter(
                SchemaPrinter.Options.defaultOptions()
                    .includeDirectives(false)
                    .includeScalarTypes(true)
                    .includeSchemaDefinition(false))
            .print(graphQlSource.schema());
    ContractSnapshots.assertMatches(
        Path.of("src/test/resources/snapshots/schema.graphql"),
        printed,
        "run `make contract-snapshots` and commit the result");
  }
}
