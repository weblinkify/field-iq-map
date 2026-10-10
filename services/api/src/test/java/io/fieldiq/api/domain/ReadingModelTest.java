package io.fieldiq.api.domain;

import static org.assertj.core.api.Assertions.assertThat;

import io.fieldiq.api.domain.ReadingModel.SensorProfile;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class ReadingModelTest {

  static final SensorProfile HELSINKI =
      new SensorProfile("FIQ-00001", 60.17, "Helsinki", SensorStatus.ONLINE);
  static final SensorProfile INARI =
      new SensorProfile("FIQ-03999", 68.9, "Inari", SensorStatus.ONLINE);
  static final long NOON = Instant.parse("2026-07-01T10:00:00Z").getEpochSecond();
  static final long NIGHT = Instant.parse("2026-07-01T01:00:00Z").getEpochSecond();

  @Test
  void fnv1aMatchesReferenceVectors() {
    assertThat(ReadingModel.fnv1a("")).isEqualTo(0x811c9dc5L);
    assertThat(ReadingModel.fnv1a("a")).isEqualTo(0xe40c292cL);
    assertThat(ReadingModel.fnv1a("foobar")).isEqualTo(0xbf9cf968L);
  }

  @Test
  void isDeterministicAndRoundedToOneDecimal() {
    double a = ReadingModel.value(HELSINKI, Metric.TEMPERATURE, NOON);
    assertThat(ReadingModel.value(HELSINKI, Metric.TEMPERATURE, NOON)).isEqualTo(a);
    assertThat(Math.round(a * 10) / 10.0).isEqualTo(a);
  }

  @Test
  void staysWithinRealisticRanges() {
    for (long t = NOON; t < NOON + 3 * 86400; t += 1800) {
      for (SensorProfile p : new SensorProfile[] {HELSINKI, INARI}) {
        assertThat(ReadingModel.value(p, Metric.TEMPERATURE, t)).isBetween(-20.0, 30.0);
        assertThat(ReadingModel.value(p, Metric.HUMIDITY, t)).isBetween(15.0, 100.0);
        assertThat(ReadingModel.value(p, Metric.NOISE, t)).isBetween(20.0, 90.0);
        assertThat(ReadingModel.value(p, Metric.PM25, t)).isBetween(0.5, 40.0);
      }
    }
  }

  @Test
  void northIsColderAndCitiesAreLouder() {
    assertThat(ReadingModel.value(INARI, Metric.TEMPERATURE, NOON))
        .isLessThan(ReadingModel.value(HELSINKI, Metric.TEMPERATURE, NOON));
    assertThat(ReadingModel.value(HELSINKI, Metric.NOISE, NOON))
        .isGreaterThan(ReadingModel.value(INARI, Metric.NOISE, NIGHT));
  }

  @Test
  void alertSensorsReadAboveThresholds() {
    SensorProfile alert = new SensorProfile("FIQ-00007", 60.2, "Helsinki", SensorStatus.ALERT);
    assertThat(ReadingModel.value(alert, Metric.PM25, NOON)).isGreaterThan(25);
    assertThat(ReadingModel.value(alert, Metric.NOISE, NOON)).isGreaterThan(70);
    assertThat(ReadingModel.value(alert, Metric.HUMIDITY, NOON)).isGreaterThanOrEqualTo(93);
  }

  @Test
  void primaryMetricPerType() {
    assertThat(SensorType.MULTI.primaryMetric()).isEqualTo(Metric.PM25);
    assertThat(SensorType.NOISE.primaryMetric()).isEqualTo(Metric.NOISE);
    assertThat(SensorType.MULTI.metrics()).hasSize(4);
    assertThat(Metric.PM25.unit()).isEqualTo("µg/m³");
  }
}
