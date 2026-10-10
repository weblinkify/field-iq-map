# syntax=docker/dockerfile:1.7
# FieldIQ mock API — build context: repository root (needs shared/).

FROM node:24-alpine AS build
WORKDIR /app
COPY services/mock-api/package.json services/mock-api/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY services/mock-api/tsconfig.json services/mock-api/tsconfig.build.json ./
COPY services/mock-api/src ./src
RUN npm run build && npm prune --omit=dev

FROM node:24-alpine
LABEL org.opencontainers.image.title="fieldiq-mock-api" \
      org.opencontainers.image.description="FieldIQ v2 mock API (same GraphQL + REST contract, fixture-backed)" \
      org.opencontainers.image.source="https://github.com/weblinkify/field-iq-map"
ENV NODE_ENV=production PORT=4000 FIELDIQ_SHARED_DIR=/app/shared
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node services/mock-api/package.json ./
COPY --chown=node:node shared/graphql ./shared/graphql
COPY --chown=node:node shared/fixtures/sensors.json ./shared/fixtures/sensors.json
USER node
EXPOSE 4000
HEALTHCHECK --interval=5s --timeout=3s --start-period=10s --retries=10 \
  CMD wget -qO- http://127.0.0.1:4000/api/v1/health | grep -q '"UP"' || exit 1
CMD ["node", "dist/index.js"]
