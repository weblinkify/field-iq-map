package io.fieldiq.api.query;

import io.fieldiq.api.domain.Metric;
import io.fieldiq.api.persistence.ReadingRepository;
import io.fieldiq.api.persistence.SensorEntity;
import io.fieldiq.api.persistence.SensorRepository;
import io.fieldiq.api.query.Views.AlertView;
import io.fieldiq.api.query.Views.Coordinates;
import io.fieldiq.api.query.Views.FeatureRow;
import io.fieldiq.api.query.Views.ReadingView;
import io.fieldiq.api.query.Views.RegionSummary;
import io.fieldiq.api.query.Views.SensorPage;
import io.fieldiq.api.query.Views.SensorStats;
import io.fieldiq.api.query.Views.SensorView;
import io.fieldiq.api.query.Views.SiteView;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class SensorQueryService {

  public static final int DEFAULT_PAGE_SIZE = 20;
  public static final int MAX_PAGE_SIZE = 200;
  public static final Duration DEFAULT_READINGS_WINDOW = Duration.ofHours(24);
  public static final Duration MAX_READINGS_WINDOW = Duration.ofDays(31);

  private final SensorQueryRepository queries;
  private final SensorRepository sensors;
  private final ReadingRepository readings;
  private final Clock clock;

  public SensorQueryService(
      SensorQueryRepository queries,
      SensorRepository sensors,
      ReadingRepository readings,
      Clock clock) {
    this.queries = queries;
    this.sensors = sensors;
    this.readings = readings;
    this.clock = clock;
  }

  public Optional<SensorView> sensor(String id) {
    return sensors.findById(id).map(SensorQueryService::toView);
  }

  public SensorView requireSensor(String id) {
    return sensor(id).orElseThrow(() -> new NotFoundException("Sensor " + id + " not found"));
  }

  public List<FeatureRow> features(SensorCriteria criteria) {
    return queries.features(criteria);
  }

  public SensorPage page(SensorCriteria criteria, Integer first, String after) {
    int size = first == null ? DEFAULT_PAGE_SIZE : first;
    if (size < 1 || size > MAX_PAGE_SIZE) {
      throw new InvalidRequestException("first must be between 1 and " + MAX_PAGE_SIZE);
    }
    List<SensorView> rows = queries.page(criteria, Cursor.decode(after), size + 1);
    boolean hasNext = rows.size() > size;
    return new SensorPage(hasNext ? rows.subList(0, size) : rows, hasNext, queries.count(criteria));
  }

  public SensorStats stats(SensorCriteria criteria) {
    return queries.stats(criteria);
  }

  public List<RegionSummary> regions() {
    return queries.regions();
  }

  public List<SiteView> sites(String region) {
    return queries.sites(region);
  }

  public Map<String, SiteView> sitesByIds(Collection<String> ids) {
    return queries.sitesByIds(ids);
  }

  public Map<String, List<ReadingView>> latestReadings(Collection<String> sensorIds) {
    return queries.latestReadings(sensorIds);
  }

  public List<AlertView> alerts(boolean activeOnly, Integer first) {
    int size = first == null ? 100 : first;
    if (size < 1 || size > 1000) {
      throw new InvalidRequestException("first must be between 1 and 1000");
    }
    return queries.alerts(activeOnly, size);
  }

  public Map<String, List<AlertView>> alertsBySensor(Collection<String> sensorIds) {
    return queries.alertsBySensor(sensorIds);
  }

  /** Hourly history; defaults to the last 24 hours. */
  public List<ReadingView> readings(String sensorId, Instant from, Instant to, Metric metric) {
    Instant end = to == null ? clock.instant() : to;
    Instant start = from == null ? end.minus(DEFAULT_READINGS_WINDOW) : from;
    if (!start.isBefore(end)) {
      throw new InvalidRequestException("from must be before to");
    }
    if (Duration.between(start, end).compareTo(MAX_READINGS_WINDOW) > 0) {
      throw new InvalidRequestException("The readings window is limited to 31 days");
    }
    return readings.findHistory(sensorId, start, end, metric).stream()
        .map(
            r ->
                new ReadingView(
                    r.getSensorId(), r.getTs(), r.getMetric(), r.getValue(), r.getUnit()))
        .toList();
  }

  static SensorView toView(SensorEntity e) {
    return new SensorView(
        e.getId(),
        e.getName(),
        e.getType(),
        e.getStatus(),
        new Coordinates(e.getLocation().getY(), e.getLocation().getX()),
        e.getMunicipality(),
        e.getRegion(),
        e.getSiteId(),
        e.getSiteName(),
        e.getInstalledAt(),
        e.getBatteryPct(),
        e.getFirmware(),
        e.getLastSeenAt());
  }
}
