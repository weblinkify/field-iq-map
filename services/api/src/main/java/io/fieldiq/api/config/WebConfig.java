package io.fieldiq.api.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.servers.Server;
import java.util.List;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.filter.ShallowEtagHeaderFilter;

@Configuration(proxyBeanMethods = false)
public class WebConfig {

  /** ETags on the bulk endpoint: unchanged map data answers 304 without a body. */
  @Bean
  FilterRegistrationBean<ShallowEtagHeaderFilter> geoJsonEtagFilter() {
    FilterRegistrationBean<ShallowEtagHeaderFilter> bean =
        new FilterRegistrationBean<>(new ShallowEtagHeaderFilter());
    bean.addUrlPatterns("/api/v1/sensors.geojson");
    return bean;
  }

  @Bean
  OpenAPI fieldIqOpenApi() {
    return new OpenAPI()
        .info(
            new Info()
                .title("FieldIQ API")
                .version("2.0.0")
                .description("Bulk map data (GeoJSON), sensor details, readings and CSV export.")
                .license(new License().name("MIT")))
        .servers(List.of(new Server().url("/").description("Same origin (proxied by nginx)")));
  }
}
