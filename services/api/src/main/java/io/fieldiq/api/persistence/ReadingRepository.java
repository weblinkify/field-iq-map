package io.fieldiq.api.persistence;

import io.fieldiq.api.domain.Metric;
import java.time.Instant;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ReadingRepository extends JpaRepository<ReadingEntity, Long> {

  @Query(
      """
      select r from ReadingEntity r
      where r.sensorId = :sensorId and r.ts >= :from and r.ts <= :to
        and (:metric is null or r.metric = :metric)
      order by r.ts, r.metric
      """)
  List<ReadingEntity> findHistory(
      @Param("sensorId") String sensorId,
      @Param("from") Instant from,
      @Param("to") Instant to,
      @Param("metric") Metric metric);
}
