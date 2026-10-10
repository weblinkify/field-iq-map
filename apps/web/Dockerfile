# syntax=docker/dockerfile:1.7
# FieldIQ web — Angular build served by unprivileged nginx. Build context: repository root.
# One image serves mock and live mode: /env.js is generated at container start from env vars.

FROM node:24-alpine AS build
ARG NG_CONFIG=production
WORKDIR /src/apps/web
COPY apps/web/package.json apps/web/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY shared/geo /src/shared/geo
COPY apps/web/ ./
RUN npm run build -- --configuration "${NG_CONFIG}"

FROM nginxinc/nginx-unprivileged:1.31-alpine
LABEL org.opencontainers.image.title="fieldiq-web" \
      org.opencontainers.image.description="FieldIQ v2 web app (Angular + MapLibre/Mapbox)" \
      org.opencontainers.image.source="https://github.com/weblinkify/field-iq-map"
COPY apps/web/docker/default.conf.template /etc/nginx/templates/default.conf.template
COPY --chmod=0755 apps/web/docker/40-fieldiq-env.sh /docker-entrypoint.d/40-fieldiq-env.sh
COPY --from=build /src/apps/web/dist/web/browser /usr/share/nginx/html
# Defaults; docker compose overrides them per profile.
ENV API_MODE=mock \
    API_UPSTREAM=http://mock-api:4000 \
    API_BASE_URL=/api/v1 \
    GRAPHQL_URL=/graphql \
    MAPBOX_TOKEN= \
    BASEMAP=openfreemap
EXPOSE 8080
HEALTHCHECK --interval=5s --timeout=3s --start-period=10s --retries=10 \
  CMD wget -q --spider http://127.0.0.1:8080/healthz || exit 1
