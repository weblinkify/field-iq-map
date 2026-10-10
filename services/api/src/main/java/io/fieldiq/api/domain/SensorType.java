package io.fieldiq.api.domain;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

@Schema(enumAsRef = true)
public enum SensorType {
  TEMPERATURE(List.of(Metric.TEMPERATURE)),
  HUMIDITY(List.of(Metric.HUMIDITY)),
  NOISE(List.of(Metric.NOISE)),
  AIR_QUALITY_PM25(List.of(Metric.PM25)),
  MULTI(List.of(Metric.TEMPERATURE, Metric.HUMIDITY, Metric.NOISE, Metric.PM25));

  private final List<Metric> metrics;

  SensorType(List<Metric> metrics) {
    this.metrics = metrics;
  }

  /** Metrics this sensor type measures. */
  public List<Metric> metrics() {
    return metrics;
  }

  /** Metric shown on the map and in tooltips. */
  public Metric primaryMetric() {
    return this == MULTI ? Metric.PM25 : metrics.getFirst();
  }
}
