package io.fieldiq.api;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

@TestConfiguration(proxyBeanMethods = false)
public class TestcontainersConfiguration {

  /** Multi-arch PostGIS image (works on Apple Silicon and x86). */
  public static final DockerImageName POSTGIS =
      DockerImageName.parse("imresamu/postgis:16-3.5-alpine").asCompatibleSubstituteFor("postgres");

  @Bean
  @ServiceConnection
  PostgreSQLContainer<?> postgis() {
    return new PostgreSQLContainer<>(POSTGIS);
  }
}
