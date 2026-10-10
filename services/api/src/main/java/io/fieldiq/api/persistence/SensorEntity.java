package io.fieldiq.api.persistence;

import io.fieldiq.api.domain.SensorStatus;
import io.fieldiq.api.domain.SensorType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import org.locationtech.jts.geom.Point;

@Entity
@Table(name = "sensor")
public class SensorEntity {

  @Id private String id;

  private String name;

  @Enumerated(EnumType.STRING)
  private SensorType type;

  @Enumerated(EnumType.STRING)
  private SensorStatus status;

  @Column(columnDefinition = "geometry(Point,4326)")
  private Point location;

  private String municipality;
  private String region;
  private String siteId;
  private String siteName;
  private Instant installedAt;
  private int batteryPct;
  private String firmware;
  private Instant lastSeenAt;

  protected SensorEntity() {}

  public String getId() {
    return id;
  }

  public String getName() {
    return name;
  }

  public SensorType getType() {
    return type;
  }

  public SensorStatus getStatus() {
    return status;
  }

  public Point getLocation() {
    return location;
  }

  public String getMunicipality() {
    return municipality;
  }

  public String getRegion() {
    return region;
  }

  public String getSiteId() {
    return siteId;
  }

  public String getSiteName() {
    return siteName;
  }

  public Instant getInstalledAt() {
    return installedAt;
  }

  public int getBatteryPct() {
    return batteryPct;
  }

  public String getFirmware() {
    return firmware;
  }

  public Instant getLastSeenAt() {
    return lastSeenAt;
  }
}
