package io.fieldiq.api.persistence;

import io.fieldiq.api.domain.Metric;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "reading")
public class ReadingEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  private String sensorId;
  private Instant ts;

  @Enumerated(EnumType.STRING)
  private Metric metric;

  private double value;
  private String unit;

  protected ReadingEntity() {}

  public String getSensorId() {
    return sensorId;
  }

  public Instant getTs() {
    return ts;
  }

  public Metric getMetric() {
    return metric;
  }

  public double getValue() {
    return value;
  }

  public String getUnit() {
    return unit;
  }
}
