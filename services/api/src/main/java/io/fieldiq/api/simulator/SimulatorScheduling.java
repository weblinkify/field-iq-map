package io.fieldiq.api.simulator;

import io.fieldiq.api.config.FieldIqProperties;
import java.time.Clock;
import java.time.Duration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.SchedulingConfigurer;
import org.springframework.scheduling.config.FixedDelayTask;
import org.springframework.scheduling.config.ScheduledTaskRegistrar;

/** Schedules {@link ReadingSimulator#tick} every {@code fieldiq.simulator.interval} (30 s). */
@Configuration(proxyBeanMethods = false)
@ConditionalOnProperty(
    name = "fieldiq.simulator.enabled",
    havingValue = "true",
    matchIfMissing = true)
public class SimulatorScheduling implements SchedulingConfigurer {

  private final ReadingSimulator simulator;
  private final FieldIqProperties properties;
  private final Clock clock;

  public SimulatorScheduling(
      ReadingSimulator simulator, FieldIqProperties properties, Clock clock) {
    this.simulator = simulator;
    this.properties = properties;
    this.clock = clock;
  }

  @Override
  public void configureTasks(ScheduledTaskRegistrar registrar) {
    Duration interval = properties.simulator().interval();
    registrar.addFixedDelayTask(
        new FixedDelayTask(() -> simulator.tick(clock.instant()), interval, interval));
  }
}
