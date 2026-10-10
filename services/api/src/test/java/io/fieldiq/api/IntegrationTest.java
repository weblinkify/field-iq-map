package io.fieldiq.api;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import org.springframework.boot.test.autoconfigure.graphql.tester.AutoConfigureGraphQlTester;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

/**
 * Full application against a PostGIS Testcontainer, seeded from the shared fixture. All test
 * classes share one Spring context (and one container).
 */
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@SpringBootTest(properties = {"fieldiq.simulator.enabled=false"})
@AutoConfigureMockMvc
@AutoConfigureGraphQlTester
@Import(TestcontainersConfiguration.class)
public @interface IntegrationTest {}
