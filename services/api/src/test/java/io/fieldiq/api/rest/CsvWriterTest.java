package io.fieldiq.api.rest;

import static org.assertj.core.api.Assertions.assertThat;

import io.fieldiq.api.domain.Metric;
import io.fieldiq.api.domain.SensorStatus;
import io.fieldiq.api.domain.SensorType;
import io.fieldiq.api.query.Views.FeatureRow;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;

class CsvWriterTest {

  @Test
  void writesHeaderAndRowsWithCrlf() {
    FeatureRow row =
        new FeatureRow(
            "FIQ-00001",
            "Kallio Noise 01",
            SensorType.NOISE,
            SensorStatus.ONLINE,
            24.95,
            60.18,
            "Helsinki",
            "Uusimaa",
            "Helsinki – Kallio",
            88,
            "2.4.2",
            Instant.parse("2026-10-10T12:00:00Z"),
            Metric.NOISE,
            52.3,
            null);
    String csv = CsvWriter.write(List.of(row));
    assertThat(csv.split("\r\n"))
        .containsExactly(
            CsvWriter.HEADER,
            "FIQ-00001,Kallio Noise 01,NOISE,ONLINE,60.18,24.95,Helsinki,Uusimaa,Helsinki – Kallio,"
                + "88,2.4.2,2026-10-10T12:00:00Z,NOISE,52.3,dB");
  }

  @Test
  void writesEmptyValueWhenMissing() {
    FeatureRow row =
        new FeatureRow(
            "FIQ-1",
            "x",
            SensorType.MULTI,
            SensorStatus.OFFLINE,
            1,
            2,
            "m",
            "r",
            "s",
            1,
            "f",
            Instant.EPOCH,
            Metric.PM25,
            null,
            null);
    assertThat(CsvWriter.write(List.of(row))).contains(",PM25,,µg/m³\r\n");
  }

  @Test
  void escapesQuotesCommasAndFormulas() {
    assertThat(CsvWriter.escape("plain")).isEqualTo("plain");
    assertThat(CsvWriter.escape("a,b")).isEqualTo("\"a,b\"");
    assertThat(CsvWriter.escape("say \"hi\"")).isEqualTo("\"say \"\"hi\"\"\"");
    assertThat(CsvWriter.escape("line\nbreak")).isEqualTo("\"line\nbreak\"");
    assertThat(CsvWriter.escape("=SUM(A1)")).isEqualTo("'=SUM(A1)");
    assertThat(CsvWriter.escape(null)).isEmpty();
  }
}
