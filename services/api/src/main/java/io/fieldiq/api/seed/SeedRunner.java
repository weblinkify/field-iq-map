package io.fieldiq.api.seed;

import io.fieldiq.api.config.FieldIqProperties;
import io.fieldiq.api.simulator.ReadingSimulator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Seeds an empty database on startup. Runs before the app reports readiness, so the Docker
 * healthcheck only passes once all 4,000 sensors are loaded.
 */
@Component
@Order(0)
public class SeedRunner implements ApplicationRunner {

  private static final Logger log = LoggerFactory.getLogger(SeedRunner.class);

  private final SeedService seedService;
  private final FieldIqProperties properties;
  private final ReadingSimulator simulator;
  private final ConfigurableApplicationContext context;

  public SeedRunner(
      SeedService seedService,
      FieldIqProperties properties,
      ReadingSimulator simulator,
      ConfigurableApplicationContext context) {
    this.seedService = seedService;
    this.simulator = simulator;
    this.properties = properties;
    this.context = context;
  }

  @Override
  public void run(ApplicationArguments args) {
    FieldIqProperties.Seed seed = properties.seed();
    if (seed.enabled() && (seed.force() || seedService.sensorCount() == 0)) {
      seedService.seed(seed.historyHours());
      simulator.reset();
    } else {
      log.info("Seeding skipped ({} sensors present)", seedService.sensorCount());
    }
    if (seed.exitAfterSeed()) {
      System.exit(SpringApplication.exit(context, () -> 0));
    }
  }
}
