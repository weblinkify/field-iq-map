# syntax=docker/dockerfile:1.7
# FieldIQ API — build context: repository root (needs shared/ for schema + fixture).

FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /src
COPY services/api/pom.xml services/api/
COPY shared/graphql shared/graphql
COPY shared/fixtures/sensors.json shared/fixtures/sensors.json
RUN --mount=type=cache,target=/root/.m2 \
    mvn -B -q -f services/api/pom.xml dependency:go-offline
COPY services/api/src services/api/src
RUN --mount=type=cache,target=/root/.m2 \
    mvn -B -q -f services/api/pom.xml package \
      -DskipTests -Dspotless.check.skip=true -Djacoco.skip=true \
 && cp services/api/target/fieldiq-api-*.jar /src/app.jar

FROM eclipse-temurin:21-jre-alpine
LABEL org.opencontainers.image.title="fieldiq-api" \
      org.opencontainers.image.description="FieldIQ v2 REST + GraphQL API (Spring Boot, PostGIS)" \
      org.opencontainers.image.source="https://github.com/weblinkify/field-iq-map"
RUN addgroup -S fieldiq && adduser -S -G fieldiq -u 10001 fieldiq
WORKDIR /app
COPY --from=build --chown=fieldiq:fieldiq /src/app.jar app.jar
USER 10001
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75 -XX:+ExitOnOutOfMemoryError" \
    PORT=8080
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=5s --start-period=120s --retries=12 \
  CMD wget -qO- http://127.0.0.1:8080/actuator/health/readiness | grep -q '"UP"' || exit 1
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
