@AGENTS.md

## Notes for Claude Code
- Start the stack with `make up-mock` (fast, no Java build) unless the task touches the backend.
- After changing the GraphQL schema or REST DTOs: `make contract-snapshots && make codegen`, then
  update both backends and run `make contract`.
- For UI changes, verify in a browser against `http://localhost:8080` (docker) or
  `http://localhost:4200` (`ng serve`); Playwright can drive the map through `window.__fieldiq`
  in dev/e2e builds.
- Keep `README.md` screenshots in sync with `cd e2e && npm run screenshots`.
