package io.fieldiq.api.domain;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(enumAsRef = true)
public enum Metric {
  TEMPERATURE("°C"),
  HUMIDITY("%"),
  NOISE("dB"),
  PM25("µg/m³");

  private final String unit;

  Metric(String unit) {
    this.unit = unit;
  }

  public String unit() {
    return unit;
  }
}
