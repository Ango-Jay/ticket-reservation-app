#!/usr/bin/env bash
# Run a k6 scenario against local Nest API. Requires: k6 on PATH, API up, bench seed.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

SCENARIO="${1:-hold-storm}"
SCRIPT="$ROOT/bench/k6/${SCENARIO}.js"

if [[ ! -f "$SCRIPT" ]]; then
  echo "Unknown scenario: ${SCENARIO} (expected file ${SCRIPT})"
  echo "Available: hold-storm | mixed-read"
  exit 1
fi

if ! command -v k6 >/dev/null 2>&1; then
  echo "k6 not found. Install: https://grafana.com/docs/k6/latest/set-up/install-k6/"
  echo "  macOS: brew install k6"
  exit 1
fi

if [[ ! -f "$ROOT/bench/.env.bench" ]]; then
  echo "Missing bench/.env.bench — run: pnpm bench:sql (or ./bench/scripts/run-sql-bench.sh)"
  exit 1
fi

# shellcheck disable=SC1091
set -a
# shellcheck source=/dev/null
source "$ROOT/bench/.env.bench"
set +a

export BASE_URL="${BASE_URL:-http://localhost:4000}"

echo "Waiting for API at ${BASE_URL} ..."
for _ in $(seq 1 60); do
  if curl -sf "${BASE_URL}/events" >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done

if ! curl -sf "${BASE_URL}/events" >/dev/null 2>&1; then
  echo "API not reachable at ${BASE_URL}. Start with: pnpm start:dev"
  exit 1
fi

echo "Running k6 ${SCENARIO}"
echo "  BASE_URL=${BASE_URL}"
echo "  EVENT_ID=${EVENT_ID:-}"
echo "  TICKET_TYPE_ID=${TICKET_TYPE_ID:-}"
echo "  EVENT_SLUG=${EVENT_SLUG:-bench-hot-path}"

mkdir -p "$ROOT/bench/out"
k6 run \
  --out "json=${ROOT}/bench/out/k6-${SCENARIO}.json" \
  -e "BASE_URL=${BASE_URL}" \
  -e "EVENT_ID=${EVENT_ID:-}" \
  -e "TICKET_TYPE_ID=${TICKET_TYPE_ID:-}" \
  -e "EVENT_SLUG=${EVENT_SLUG:-bench-hot-path}" \
  "$SCRIPT"
