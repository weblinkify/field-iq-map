package io.fieldiq.api.config;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "fieldiq")
public record FieldIqProperties(Seed seed, Simulator simulator) {

  public FieldIqProperties {
    seed = seed == null ? new Seed(true, false, 24, false) : seed;
    simulator = simulator == null ? new Simulator(true, Duration.ofSeconds(30)) : simulator;
  }

  /**
   * @param enabled seed an empty database on startup
   * @param force wipe and re-seed even when data exists
   * @param historyHours hourly history to generate per sensor
   * @param exitAfterSeed stop the process after seeding (used by {@code make seed})
   */
  public record Seed(boolean enabled, boolean force, int historyHours, boolean exitAfterSeed) {}

  public record Simulator(boolean enabled, Duration interval) {}
}
