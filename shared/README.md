# shared/ — contracts and data used by every FieldIQ v2 service

| Path | What it is | Who uses it |
| --- | --- | --- |
| `graphql/schema.graphqls` | GraphQL schema (single source of truth) | `services/api` (schema-first), `services/mock-api`, `apps/web` codegen |
| `openapi/openapi.yaml` | REST contract, **exported from the backend** (`make openapi`); CI fails if stale | `services/mock-api`, `apps/web` codegen |
| `geo/finland.geojson` | Finland + Åland boundary, Natural Earth 1:50m (public domain) | generator, map outline layer, backend tests |
| `fixtures/sensors.json` | 4,000 deterministic sensors, 264 sites, alerts | mock API (served directly), real API (seeded into PostGIS) |
| `fixtures/readings-golden.json` | Sample values of the shared reading model | backend test proves Java and TypeScript models agree |
| `scripts/generate-sensors.ts` | Fixture generator (`make fixtures`) | — |

## Cross-service conventions

- **Cursor** (`sensors(after:)`): base64 of `sensor:<id>`; pages are ordered by id.
- **Relative times** in the fixture (`lastSeenSecondsAgo`, `createdSecondsAgo`) are applied to the
  current time when the API starts (real) or answers (mock), so data always looks fresh.
- **Readings** are hourly. Values come from one deterministic function of
  `(sensor id, metric, timestamp, latitude, municipality, status)`, implemented in
  `services/mock-api/src/domain/readings.ts` and `services/api/.../ReadingModel.java`.
- **Errors** (REST) are RFC 7807 `application/problem+json` with `type`, `title`, `status`, `detail`.
- **Metrics/units**: `TEMPERATURE` °C, `HUMIDITY` %, `NOISE` dB, `PM25` µg/m³.
  Sensor type → metrics: `TEMPERATURE`→TEMPERATURE, `HUMIDITY`→HUMIDITY, `NOISE`→NOISE,
  `AIR_QUALITY_PM25`→PM25, `MULTI`→all four. The map's "primary" metric is the first in that list
  (PM25 for MULTI).
