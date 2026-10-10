package io.fieldiq.api.graphql;

import io.fieldiq.api.domain.Metric;
import io.fieldiq.api.graphql.GraphQlTypes.BBoxInput;
import io.fieldiq.api.graphql.GraphQlTypes.PageInfo;
import io.fieldiq.api.graphql.GraphQlTypes.SensorConnection;
import io.fieldiq.api.graphql.GraphQlTypes.SensorEdge;
import io.fieldiq.api.graphql.GraphQlTypes.SensorFilter;
import io.fieldiq.api.query.Cursor;
import io.fieldiq.api.query.SensorQueryService;
import io.fieldiq.api.query.Views.AlertView;
import io.fieldiq.api.query.Views.ReadingView;
import io.fieldiq.api.query.Views.RegionSummary;
import io.fieldiq.api.query.Views.SensorPage;
import io.fieldiq.api.query.Views.SensorStats;
import io.fieldiq.api.query.Views.SensorView;
import io.fieldiq.api.query.Views.SiteView;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import org.dataloader.DataLoader;
import org.springframework.graphql.data.method.annotation.Argument;
import org.springframework.graphql.data.method.annotation.BatchMapping;
import org.springframework.graphql.data.method.annotation.QueryMapping;
import org.springframework.graphql.data.method.annotation.SchemaMapping;
import org.springframework.graphql.execution.BatchLoaderRegistry;
import org.springframework.stereotype.Controller;
import reactor.core.publisher.Mono;

/**
 * Schema-first resolvers for {@code shared/graphql/schema.graphqls}. Nested fields (site, latest
 * readings, alerts) are batched per request, so a page of 200 sensors costs a constant number of
 * SQL queries instead of 1 + N.
 */
@Controller
public class SensorGraphQlController {

  static final String ALERTS_BY_SENSOR = "alertsBySensor";

  private final SensorQueryService service;

  public SensorGraphQlController(SensorQueryService service, BatchLoaderRegistry registry) {
    this.service = service;
    registry
        .<String, List<AlertView>>forName(ALERTS_BY_SENSOR)
        .registerMappedBatchLoader(
            (ids, env) -> Mono.fromCallable(() -> service.alertsBySensor(ids)));
  }

  @QueryMapping
  public SensorView sensor(@Argument String id) {
    return service.sensor(id).orElse(null);
  }

  @QueryMapping
  public SensorConnection sensors(
      @Argument SensorFilter filter,
      @Argument BBoxInput bbox,
      @Argument Integer first,
      @Argument String after) {
    SensorPage page = service.page(GraphQlTypes.criteria(filter, bbox), first, after);
    List<SensorEdge> edges =
        page.items().stream().map(s -> new SensorEdge(Cursor.encode(s.id()), s)).toList();
    String endCursor = edges.isEmpty() ? null : edges.getLast().cursor();
    return new SensorConnection(
        edges, new PageInfo(page.hasNextPage(), endCursor), page.totalCount());
  }

  @QueryMapping
  public SensorStats sensorStats(@Argument BBoxInput bbox, @Argument SensorFilter filter) {
    return service.stats(GraphQlTypes.criteria(filter, bbox));
  }

  @QueryMapping
  public List<RegionSummary> regions() {
    return service.regions();
  }

  @QueryMapping
  public List<SiteView> sites(@Argument String region) {
    return service.sites(region);
  }

  @QueryMapping
  public List<AlertView> alerts(@Argument Boolean activeOnly, @Argument Integer first) {
    return service.alerts(activeOnly == null || activeOnly, first);
  }

  @BatchMapping(typeName = "Sensor")
  public Map<SensorView, SiteView> site(List<SensorView> sensors) {
    Map<String, SiteView> sites =
        service.sitesByIds(sensors.stream().map(SensorView::siteId).distinct().toList());
    Map<SensorView, SiteView> out = new LinkedHashMap<>();
    sensors.forEach(s -> out.put(s, sites.get(s.siteId())));
    return out;
  }

  @BatchMapping(typeName = "Sensor")
  public Map<SensorView, List<ReadingView>> latestReadings(List<SensorView> sensors) {
    Map<String, List<ReadingView>> latest =
        service.latestReadings(sensors.stream().map(SensorView::id).toList());
    Map<SensorView, List<ReadingView>> out = new LinkedHashMap<>();
    sensors.forEach(s -> out.put(s, latest.getOrDefault(s.id(), List.of())));
    return out;
  }

  @SchemaMapping(typeName = "Sensor")
  public CompletableFuture<List<AlertView>> alerts(
      SensorView sensor,
      @Argument Boolean activeOnly,
      DataLoader<String, List<AlertView>> alertsBySensor) {
    boolean active = Boolean.TRUE.equals(activeOnly);
    return alertsBySensor
        .load(sensor.id())
        .thenApply(
            list ->
                list == null
                    ? List.of()
                    : list.stream().filter(a -> !active || a.resolvedAt() == null).toList());
  }

  @SchemaMapping(typeName = "Sensor")
  public List<ReadingView> readings(
      SensorView sensor, @Argument Instant from, @Argument Instant to, @Argument Metric metric) {
    return service.readings(sensor.id(), from, to, metric);
  }
}
