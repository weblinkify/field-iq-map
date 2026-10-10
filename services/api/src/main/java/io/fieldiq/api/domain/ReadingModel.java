package io.fieldiq.api.domain;

import java.util.Set;

/**
 * Deterministic reading model shared with the mock API ({@code
 * services/mock-api/src/domain/readings.ts}). Both implementations are checked against {@code
 * shared/fixtures/readings-golden.json}, so real and mock mode produce the same values.
 */
public final class ReadingModel {

  /** The nine population centres; sensors there get the "urban" noise and PM2.5 profile. */
  public static final Set<String> POPULATION_CENTRES =
      Set.of(
          "Helsinki",
          "Espoo",
          "Tampere",
          "Turku",
          "Oulu",
          "Jyväskylä",
          "Kuopio",
          "Lahti",
          "Rovaniemi");

  private ReadingModel() {}

  /** Input describing a sensor for the model. */
  public record SensorProfile(String id, double lat, String municipality, SensorStatus status) {}

  /** Value of {@code metric} for {@code sensor} at {@code epochSecond}, rounded to 0.1. */
  public static double value(SensorProfile sensor, Metric metric, long epochSecond) {
    double urban = POPULATION_CENTRES.contains(sensor.municipality()) ? 1.0 : 0.35;
    double hour = floorMod(epochSecond / 3600.0 + 2, 24);
    double day = Math.sin(2 * Math.PI * (hour - 9) / 24);
    double rush =
        Math.exp(-((hour - 8) * (hour - 8)) / 2) + Math.exp(-((hour - 17) * (hour - 17)) / 2);
    double offset = unit01(sensor.id() + "|" + metric.name()) - 0.5;
    double jitter =
        unit01(sensor.id() + "|" + metric.name() + "|" + Math.floorDiv(epochSecond, 300)) - 0.5;
    boolean alert = sensor.status() == SensorStatus.ALERT;

    double v =
        switch (metric) {
          case TEMPERATURE -> {
            double t = 12 - (sensor.lat() - 60) * 1.4 + 5 * day + 3 * offset + 0.8 * jitter;
            yield alert ? t + 22 : t;
          }
          case HUMIDITY -> {
            double h = clamp(72 - 14 * day + 10 * offset + 3 * jitter, 15, 100);
            yield alert ? Math.max(h, 93) : h;
          }
          case NOISE -> {
            double n =
                34 + 16 * urban + 12 * urban * rush - (hour < 6 ? 6 : 0) + 6 * offset + 3 * jitter;
            yield alert ? n + 30 : n;
          }
          case PM25 -> {
            double p = Math.max(0.5, 4 + 7 * urban + 6 * urban * rush + 4 * offset + 1.5 * jitter);
            yield alert ? p * 3 + 20 : p;
          }
        };
    return Math.round(v * 10) / 10.0;
  }

  /** 32-bit FNV-1a over UTF-16 code units (matches {@code charCodeAt} in TypeScript). */
  static long fnv1a(String s) {
    int h = 0x811c9dc5;
    for (int i = 0; i < s.length(); i++) {
      h ^= s.charAt(i);
      h *= 0x01000193;
    }
    return Integer.toUnsignedLong(h);
  }

  static double unit01(String s) {
    return fnv1a(s) / 4294967296.0;
  }

  private static double floorMod(double x, double m) {
    return ((x % m) + m) % m;
  }

  private static double clamp(double v, double min, double max) {
    return Math.max(min, Math.min(max, v));
  }
}
