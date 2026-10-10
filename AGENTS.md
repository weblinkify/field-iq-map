# AGENTS.md — FieldIQ v2

Guidance for AI coding agents and contributors working in this repository.

## Layout
- `apps/web` — Angular 22 (standalone components, signals, zoneless, strict TS, Tailwind 4, Vitest).
- `services/api` — Spring Boot 3.5 / Java 21 / Maven wrapper, Spring for GraphQL (schema-first),
  Spring Data JPA + Hibernate Spatial, Flyway, PostGIS, springdoc.
- `services/mock-api` — Express 5 + GraphQL Yoga serving the same contract from fixtures.
- `shared/` — the contract (`graphql/schema.graphqls`, `openapi/openapi.yaml`), Finland boundary,
  fixtures and the fixture generator.
- `e2e/` — Playwright suite run against both docker profiles.

## Commands
| Task | Command |
| --- | --- |
| Run (mock / real) | `make up-mock` / `make up-real`, `make down` |
| Local dev | `make dev` (PostGIS + API + ng serve), `make dev-mock` |
| All unit/integration tests | `make test` |
| Lint everything | `make lint` |
| Regenerate API types | `make codegen` (commit the output) |
| Regenerate OpenAPI + GraphQL snapshots | `make contract-snapshots` (commit the output) |
| Regenerate fixtures | `make fixtures` then `cd services/mock-api && npm run golden` |
| Contract tests | `make contract` |
| E2E | `make e2e-mock`, `make e2e-real` |
| Re-seed real DB | `make seed` |

The backend needs Docker for Testcontainers (`./mvnw verify`).

## Conventions
- **Contracts first.** Change `shared/graphql/schema.graphqls` (or the Java REST DTOs), then run
  `make contract-snapshots` and `make codegen`, implement in **both** `services/api` and
  `services/mock-api`, and keep `make contract` green. Never hand-write API types in the frontend.
- **No `any`.** ESLint fails on `@typescript-eslint/no-explicit-any`.
- **Determinism.** Fixtures are seeded (`DEFAULT_SEED`). The reading model exists in TS and Java;
  `shared/fixtures/readings-golden.json` must match both.
- **Map code** goes through `features/map/engine/gl-map.ts` (`GlMap`, `MapEngine`); never import
  `maplibre-gl` / `mapbox-gl` outside the engine implementations. Use GL layers, not DOM markers.
- **URL is state** for the map: sensor, bbox, filters and layer live in query params
  (`state/url-state.ts`).
- **Test hooks** (`window.__fieldiq`) only exist when `environment.testHooks` is true (dev and the
  `e2e` build configuration), never in production.
- Java is formatted with Spotless (google-java-format): run `./mvnw spotless:apply`.
  TypeScript is formatted with Prettier.
- Conventional commits (`feat(web): …`, `fix(api): …`, `test(e2e): …`).
- No secrets in the repo; configuration comes from env vars (`.env.example`).
