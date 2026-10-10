package io.fieldiq.api.graphql;

import io.fieldiq.api.domain.SensorStatus;
import io.fieldiq.api.domain.SensorType;
import io.fieldiq.api.query.BBox;
import io.fieldiq.api.query.SensorCriteria;
import io.fieldiq.api.query.Views.SensorView;
import java.util.List;

/** GraphQL input/output records that have no REST counterpart. */
final class GraphQlTypes {

  private GraphQlTypes() {}

  record BBoxInput(double minLon, double minLat, double maxLon, double maxLat) {
    BBox toBBox() {
      return new BBox(minLon, minLat, maxLon, maxLat);
    }
  }

  record SensorFilter(
      List<SensorType> types, List<SensorStatus> statuses, List<String> regions, String search) {}

  static SensorCriteria criteria(SensorFilter filter, BBoxInput bbox) {
    BBox box = bbox == null ? null : bbox.toBBox();
    return filter == null
        ? SensorCriteria.of(box, null, null, null, null)
        : SensorCriteria.of(
            box, filter.types(), filter.statuses(), filter.regions(), filter.search());
  }

  record PageInfo(boolean hasNextPage, String endCursor) {}

  record SensorEdge(String cursor, SensorView node) {}

  record SensorConnection(List<SensorEdge> edges, PageInfo pageInfo, int totalCount) {}
}
