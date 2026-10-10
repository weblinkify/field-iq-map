package io.fieldiq.api.contract;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * Compares generated contract artifacts with the committed copies. Run with {@code
 * -Dcontract.update=true} ({@code make contract-snapshots}) to rewrite them.
 */
final class ContractSnapshots {

  private ContractSnapshots() {}

  static Path sharedDir() {
    return Path.of(System.getProperty("fieldiq.shared.dir", "../../shared"));
  }

  static void assertMatches(Path committed, String generated, String hint) throws IOException {
    String normalized = generated.replace("\r\n", "\n").stripTrailing() + "\n";
    if (Boolean.getBoolean("contract.update")) {
      Files.createDirectories(committed.getParent());
      Files.writeString(committed, normalized, StandardCharsets.UTF_8);
      return;
    }
    assertThat(committed).as("%s is missing — %s", committed, hint).exists();
    assertThat(Files.readString(committed, StandardCharsets.UTF_8))
        .as("%s is out of date — %s", committed, hint)
        .isEqualTo(normalized);
  }
}
