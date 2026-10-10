package io.fieldiq.api.query;

import io.fieldiq.api.domain.SensorStatus;
import io.fieldiq.api.domain.SensorType;
import java.util.Collection;
import java.util.Set;

/** Filters shared by the GeoJSON, CSV, list and stats queries. Empty sets mean "any". */
public record SensorCriteria(
    BBox bbox,
    Set<SensorType> types,
    Set<SensorStatus> statuses,
    Set<String> regions,
    String search) {

  public static final SensorCriteria ALL =
      new SensorCriteria(null, Set.of(), Set.of(), Set.of(), null);

  public SensorCriteria {
    types = types == null ? Set.of() : Set.copyOf(types);
    statuses = statuses == null ? Set.of() : Set.copyOf(statuses);
    regions = regions == null ? Set.of() : Set.copyOf(regions);
    search = search == null || search.isBlank() ? null : search.trim();
  }

  public static SensorCriteria of(
      BBox bbox,
      Collection<SensorType> types,
      Collection<SensorStatus> statuses,
      Collection<String> regions,
      String search) {
    return new SensorCriteria(
        bbox,
        types == null ? null : Set.copyOf(types),
        statuses == null ? null : Set.copyOf(statuses),
        regions == null ? null : Set.copyOf(regions),
        search);
  }
}
