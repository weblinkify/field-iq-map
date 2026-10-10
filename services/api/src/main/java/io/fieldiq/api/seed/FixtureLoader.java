package io.fieldiq.api.seed;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

/** Loads the shared fixture that Maven packages at {@code classpath:seed/sensors.json}. */
@Component
public class FixtureLoader {

  static final String LOCATION = "seed/sensors.json";

  private final ObjectMapper mapper;

  public FixtureLoader(ObjectMapper mapper) {
    this.mapper = mapper;
  }

  public Fixture load() {
    try (InputStream in = new ClassPathResource(LOCATION).getInputStream()) {
      return mapper.readValue(in, Fixture.class);
    } catch (IOException e) {
      throw new UncheckedIOException("Cannot read " + LOCATION, e);
    }
  }
}
