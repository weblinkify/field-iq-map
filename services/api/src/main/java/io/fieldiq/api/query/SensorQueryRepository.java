package io.fieldiq.api.query;

import io.fieldiq.api.domain.AlertSeverity;
import io.fieldiq.api.domain.Metric;
import io.fieldiq.api.domain.SensorStatus;
import io.fieldiq.api.domain.SensorType;
import io.fieldiq.api.query.Views.AlertView;
import io.fieldiq.api.query.Views.Coordinates;
import io.fieldiq.api.query.Views.FeatureRow;
import io.fieldiq.api.query.Views.MetricAverage;
import io.fieldiq.api.query.Views.ReadingView;
import io.fieldiq.api.query.Views.RegionSummary;
import io.fieldiq.api.query.Views.SensorStats;
import io.fieldiq.api.query.Views.SensorView;
import io.fieldiq.api.query.Views.SiteView;
import io.fieldiq.api.query.Views.StatusCount;
import io.fieldiq.api.query.Views.TypeCount;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * Hand-written SQL for the bulk/bbox/aggregate queries. Bounding boxes use {@code location &&
 * ST_MakeEnvelope(...)}, which is answered by the GiST index on {@code sensor.location}.
 */
@Repository
public class SensorQueryRepository {

  private static final String PRIMARY_METRIC_SQL =
      "CASE s.type WHEN 'TEMPERATURE' THEN 'TEMPERATURE' WHEN 'HUMIDITY' THEN 'HUMIDITY'"
          + " WHEN 'NOISE' THEN 'NOISE' ELSE 'PM25' END";

  private static final String SENSOR_COLUMNS =
      "s.id, s.name, s.type, s.status, ST_X(s.location) AS lon, ST_Y(s.location) AS lat,"
          + " s.municipality, s.region, s.site_id, s.site_name, s.installed_at, s.battery_pct,"
          + " s.firmware, s.last_seen_at";

  private final NamedParameterJdbcTemplate jdbc;

  public SensorQueryRepository(NamedParameterJdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  /** WHERE clause (without the keyword) for the criteria; always valid SQL. */
  static String where(SensorCriteria c, MapSqlParameterSource p) {
    List<String> clauses = new ArrayList<>();
    clauses.add("TRUE");
    if (c.bbox() != null) {
      clauses.add("s.location && ST_MakeEnvelope(:minLon, :minLat, :maxLon, :maxLat, 4326)");
      p.addValue("minLon", c.bbox().minLon())
          .addValue("minLat", c.bbox().minLat())
          .addValue("maxLon", c.bbox().maxLon())
          .addValue("maxLat", c.bbox().maxLat());
    }
    if (!c.types().isEmpty()) {
      clauses.add("s.type IN (:types)");
      p.addValue("types", c.types().stream().map(Enum::name).toList());
    }
    if (!c.statuses().isEmpty()) {
      clauses.add("s.status IN (:statuses)");
      p.addValue("statuses", c.statuses().stream().map(Enum::name).toList());
    }
    if (!c.regions().isEmpty()) {
      clauses.add("s.region IN (:regions)");
      p.addValue("regions", List.copyOf(c.regions()));
    }
    if (c.search() != null) {
      clauses.add(
          "(s.id ILIKE :q OR s.name ILIKE :q OR s.municipality ILIKE :q OR s.site_name ILIKE :q)");
      p.addValue("q", "%" + c.search().replace("%", "\\%").replace("_", "\\_") + "%");
    }
    return String.join(" AND ", clauses);
  }

  public List<FeatureRow> features(SensorCriteria c) {
    MapSqlParameterSource p = new MapSqlParameterSource();
    String sql =
        "SELECT s.id, s.name, s.type, s.status, ST_X(s.location) AS lon, ST_Y(s.location) AS lat,"
            + " s.municipality, s.region, s.site_name, s.battery_pct, s.firmware, s.last_seen_at,"
            + " "
            + PRIMARY_METRIC_SQL
            + " AS metric, lp.value AS value, pm.value AS pm25"
            + " FROM sensor s"
            + " LEFT JOIN latest_reading lp ON lp.sensor_id = s.id AND lp.metric = "
            + PRIMARY_METRIC_SQL
            + " LEFT JOIN latest_reading pm ON pm.sensor_id = s.id AND pm.metric = 'PM25'"
            + " WHERE "
            + where(c, p)
            + " ORDER BY s.id COLLATE \"C\"";
    return jdbc.query(
        sql,
        p,
        (rs, i) ->
            new FeatureRow(
                rs.getString("id"),
                rs.getString("name"),
                SensorType.valueOf(rs.getString("type")),
                SensorStatus.valueOf(rs.getString("status")),
                rs.getDouble("lon"),
                rs.getDouble("lat"),
                rs.getString("municipality"),
                rs.getString("region"),
                rs.getString("site_name"),
                rs.getInt("battery_pct"),
                rs.getString("firmware"),
                instant(rs, "last_seen_at"),
                Metric.valueOf(rs.getString("metric")),
                nullableDouble(rs, "value"),
                nullableDouble(rs, "pm25")));
  }

  public int count(SensorCriteria c) {
    MapSqlParameterSource p = new MapSqlParameterSource();
    Integer n =
        jdbc.queryForObject("SELECT count(*) FROM sensor s WHERE " + where(c, p), p, Integer.class);
    return n == null ? 0 : n;
  }

  /** Sensors ordered by id, strictly after {@code afterId} when given. */
  public List<SensorView> page(SensorCriteria c, String afterId, int limit) {
    MapSqlParameterSource p = new MapSqlParameterSource();
    String sql = "SELECT " + SENSOR_COLUMNS + " FROM sensor s WHERE " + where(c, p);
    if (afterId != null) {
      sql += " AND s.id COLLATE \"C\" > :after";
      p.addValue("after", afterId);
    }
    sql += " ORDER BY s.id COLLATE \"C\" LIMIT :limit";
    p.addValue("limit", limit);
    return jdbc.query(sql, p, SENSOR_MAPPER);
  }

  public SensorStats stats(SensorCriteria c) {
    MapSqlParameterSource p = new MapSqlParameterSource();
    String where = where(c, p);

    Map<SensorStatus, Integer> byStatus = new EnumMap<>(SensorStatus.class);
    Map<SensorType, Integer> byType = new EnumMap<>(SensorType.class);
    jdbc.query(
        "SELECT s.status, s.type, count(*) AS n FROM sensor s WHERE "
            + where
            + " GROUP BY s.status, s.type",
        p,
        rs -> {
          int n = rs.getInt("n");
          byStatus.merge(SensorStatus.valueOf(rs.getString("status")), n, Integer::sum);
          byType.merge(SensorType.valueOf(rs.getString("type")), n, Integer::sum);
        });

    Map<Metric, MetricAverage> averages = new EnumMap<>(Metric.class);
    jdbc.query(
        "SELECT lr.metric, avg(lr.value) AS average, count(*) AS n FROM latest_reading lr"
            + " JOIN sensor s ON s.id = lr.sensor_id WHERE "
            + where
            + " AND s.status <> 'OFFLINE' GROUP BY lr.metric",
        p,
        rs -> {
          Metric m = Metric.valueOf(rs.getString("metric"));
          averages.put(
              m, new MetricAverage(m, round2(rs.getDouble("average")), m.unit(), rs.getInt("n")));
        });

    Integer activeAlerts =
        jdbc.queryForObject(
            "SELECT count(*) FROM alert a JOIN sensor s ON s.id = a.sensor_id"
                + " WHERE a.resolved_at IS NULL AND "
                + where,
            p,
            Integer.class);
    Integer regions =
        jdbc.queryForObject(
            "SELECT count(DISTINCT s.region) FROM sensor s WHERE " + where, p, Integer.class);

    int total = byStatus.values().stream().mapToInt(Integer::intValue).sum();
    return new SensorStats(
        total,
        Arrays.stream(SensorStatus.values())
            .map(s -> new StatusCount(s, byStatus.getOrDefault(s, 0)))
            .toList(),
        Arrays.stream(SensorType.values())
            .map(t -> new TypeCount(t, byType.getOrDefault(t, 0)))
            .toList(),
        Arrays.stream(Metric.values())
            .map(m -> averages.getOrDefault(m, new MetricAverage(m, null, m.unit(), 0)))
            .toList(),
        activeAlerts == null ? 0 : activeAlerts,
        regions == null ? 0 : regions);
  }

  public List<RegionSummary> regions() {
    return jdbc
        .query(
            "SELECT region, count(*) AS n,"
                + " count(*) FILTER (WHERE status = 'ONLINE') AS online,"
                + " count(*) FILTER (WHERE status = 'ALERT') AS alert"
                + " FROM sensor GROUP BY region",
            (rs, i) ->
                new RegionSummary(
                    rs.getString("region"),
                    rs.getInt("n"),
                    rs.getInt("online"),
                    rs.getInt("alert")))
        .stream()
        // Code-point order, identical to the mock API's JavaScript sort.
        .sorted(Comparator.comparing(RegionSummary::region))
        .toList();
  }

  public List<SiteView> sites(String region) {
    MapSqlParameterSource p = new MapSqlParameterSource();
    String sql = SITE_SQL;
    if (region != null) {
      sql += " WHERE st.region = :region";
      p.addValue("region", region);
    }
    return jdbc.query(sql + " ORDER BY st.id", p, SITE_MAPPER);
  }

  public Map<String, SiteView> sitesByIds(Collection<String> ids) {
    if (ids.isEmpty()) {
      return Map.of();
    }
    return jdbc.query(SITE_SQL + " WHERE st.id IN (:ids)", Map.of("ids", ids), SITE_MAPPER).stream()
        .collect(Collectors.toMap(SiteView::id, s -> s));
  }

  public Map<String, List<ReadingView>> latestReadings(Collection<String> sensorIds) {
    if (sensorIds.isEmpty()) {
      return Map.of();
    }
    Map<String, List<ReadingView>> out = new LinkedHashMap<>();
    jdbc.query(
        "SELECT sensor_id, ts, metric, value, unit FROM latest_reading"
            + " WHERE sensor_id IN (:ids) ORDER BY sensor_id, metric",
        Map.of("ids", sensorIds),
        rs -> {
          ReadingView r =
              new ReadingView(
                  rs.getString("sensor_id"),
                  instant(rs, "ts"),
                  Metric.valueOf(rs.getString("metric")),
                  rs.getDouble("value"),
                  rs.getString("unit"));
          out.computeIfAbsent(r.sensorId(), k -> new ArrayList<>()).add(r);
        });
    return out;
  }

  public List<AlertView> alerts(boolean activeOnly, int limit) {
    String sql =
        ALERT_SQL
            + (activeOnly ? " WHERE a.resolved_at IS NULL" : "")
            + " ORDER BY a.created_at DESC, a.id LIMIT :limit";
    return jdbc.query(sql, Map.of("limit", limit), ALERT_MAPPER);
  }

  public Map<String, List<AlertView>> alertsBySensor(Collection<String> sensorIds) {
    if (sensorIds.isEmpty()) {
      return Map.of();
    }
    return jdbc
        .query(
            ALERT_SQL + " WHERE a.sensor_id IN (:ids) ORDER BY a.created_at DESC, a.id",
            Map.of("ids", sensorIds),
            ALERT_MAPPER)
        .stream()
        .collect(
            Collectors.groupingBy(AlertView::sensorId, LinkedHashMap::new, Collectors.toList()));
  }

  // ---------------------------------------------------------------------------------------------

  private static final String SITE_SQL =
      "SELECT st.id, st.name, st.municipality, st.region, ST_X(st.location) AS lon,"
          + " ST_Y(st.location) AS lat,"
          + " (SELECT count(*) FROM sensor s WHERE s.site_id = st.id) AS sensor_count"
          + " FROM site st";

  private static final String ALERT_SQL =
      "SELECT a.id, a.sensor_id, s.name AS sensor_name, a.severity, a.message, a.created_at,"
          + " a.resolved_at FROM alert a JOIN sensor s ON s.id = a.sensor_id";

  static final RowMapper<SensorView> SENSOR_MAPPER =
      (rs, i) ->
          new SensorView(
              rs.getString("id"),
              rs.getString("name"),
              SensorType.valueOf(rs.getString("type")),
              SensorStatus.valueOf(rs.getString("status")),
              new Coordinates(rs.getDouble("lat"), rs.getDouble("lon")),
              rs.getString("municipality"),
              rs.getString("region"),
              rs.getString("site_id"),
              rs.getString("site_name"),
              instant(rs, "installed_at"),
              rs.getInt("battery_pct"),
              rs.getString("firmware"),
              instant(rs, "last_seen_at"));

  private static final RowMapper<SiteView> SITE_MAPPER =
      (rs, i) ->
          new SiteView(
              rs.getString("id"),
              rs.getString("name"),
              rs.getString("municipality"),
              rs.getString("region"),
              new Coordinates(rs.getDouble("lat"), rs.getDouble("lon")),
              rs.getInt("sensor_count"));

  private static final RowMapper<AlertView> ALERT_MAPPER =
      (rs, i) ->
          new AlertView(
              rs.getString("id"),
              rs.getString("sensor_id"),
              rs.getString("sensor_name"),
              AlertSeverity.valueOf(rs.getString("severity")),
              rs.getString("message"),
              instant(rs, "created_at"),
              instant(rs, "resolved_at"));

  private static Instant instant(ResultSet rs, String column) throws SQLException {
    Timestamp ts = rs.getTimestamp(column);
    return ts == null ? null : ts.toInstant();
  }

  private static Double nullableDouble(ResultSet rs, String column) throws SQLException {
    double v = rs.getDouble(column);
    return rs.wasNull() ? null : v;
  }

  static Double round2(double v) {
    return Math.round(v * 100) / 100.0;
  }
}
