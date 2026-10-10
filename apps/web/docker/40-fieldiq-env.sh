#!/bin/sh
# Writes /env.js (served from /tmp, the image runs as a non-root user) from environment
# variables, so the same image works against the mock or the live API without a rebuild.
set -eu

js_string() {
  # Escape backslashes and double quotes for a JS string literal.
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'
}

mkdir -p /tmp/fieldiq
{
  printf 'window.__FIELDIQ_CONFIG__ = {\n'
  printf '  apiMode: "%s",\n' "$(js_string "${API_MODE:-mock}")"
  printf '  apiBaseUrl: "%s",\n' "$(js_string "${API_BASE_URL:-/api/v1}")"
  printf '  graphqlUrl: "%s",\n' "$(js_string "${GRAPHQL_URL:-/graphql}")"
  printf '  mapboxToken: "%s",\n' "$(js_string "${MAPBOX_TOKEN:-}")"
  printf '  basemap: "%s"\n' "$(js_string "${BASEMAP:-openfreemap}")"
  printf '};\n'
} > /tmp/fieldiq/env.js

echo "fieldiq: env.js written (mode=${API_MODE:-mock}, upstream=${API_UPSTREAM:-unset}, basemap=${BASEMAP:-openfreemap})"
