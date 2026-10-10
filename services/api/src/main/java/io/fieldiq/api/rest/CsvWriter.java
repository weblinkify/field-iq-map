package io.fieldiq.api.rest;

import io.fieldiq.api.query.Views.FeatureRow;
import java.util.List;

/** RFC 4180 CSV for the sensor export. */
public final class CsvWriter {

  static final String HEADER =
      "id,name,type,status,lat,lon,municipality,region,site,battery_pct,firmware,last_seen_at,"
          + "metric,value,unit";

  private CsvWriter() {}

  public static String write(List<FeatureRow> rows) {
    StringBuilder sb = new StringBuilder(HEADER.length() + rows.size() * 160);
    sb.append(HEADER).append("\r\n");
    for (FeatureRow r : rows) {
      sb.append(escape(r.id()))
          .append(',')
          .append(escape(r.name()))
          .append(',')
          .append(r.type())
          .append(',')
          .append(r.status())
          .append(',')
          .append(r.lat())
          .append(',')
          .append(r.lon())
          .append(',')
          .append(escape(r.municipality()))
          .append(',')
          .append(escape(r.region()))
          .append(',')
          .append(escape(r.siteName()))
          .append(',')
          .append(r.batteryPct())
          .append(',')
          .append(escape(r.firmware()))
          .append(',')
          .append(r.lastSeenAt())
          .append(',')
          .append(r.metric())
          .append(',')
          .append(r.value() == null ? "" : r.value())
          .append(',')
          .append(escape(r.metric().unit()))
          .append("\r\n");
    }
    return sb.toString();
  }

  static String escape(String value) {
    if (value == null) {
      return "";
    }
    // Neutralise spreadsheet formula injection, then quote when needed.
    String v = value.matches("^[=+\\-@\\t\\r].*") ? "'" + value : value;
    if (v.contains(",") || v.contains("\"") || v.contains("\n") || v.contains("\r")) {
      return '"' + v.replace("\"", "\"\"") + '"';
    }
    return v;
  }
}
