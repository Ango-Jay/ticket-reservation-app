#!/usr/bin/env bash
# Seed + EXPLAIN + parallel SQL contention against Docker Postgres.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

WORKERS="${WORKERS:-40}"
COMPOSE_SERVICE="${COMPOSE_SERVICE:-postgres}"
SQL_DIR="$ROOT/bench/sql"
OUT_DIR="$ROOT/bench/out"
mkdir -p "$OUT_DIR"

psql_docker() {
  docker compose exec -T "$COMPOSE_SERVICE" \
    psql -U "${POSTGRES_USER:-ticket}" -d "${POSTGRES_DB:-ticket_reservation}" \
    -v ON_ERROR_STOP=1 "$@"
}

echo "==> Ensuring Postgres is up"
docker compose up -d "$COMPOSE_SERVICE" >/dev/null
until docker compose exec -T "$COMPOSE_SERVICE" pg_isready -U "${POSTGRES_USER:-ticket}" -d "${POSTGRES_DB:-ticket_reservation}" >/dev/null 2>&1; do
  sleep 0.5
done

echo "==> Extensions"
psql_docker -f - <"$SQL_DIR/00_enable_extensions.sql" | tee "$OUT_DIR/00_extensions.log"

echo "==> Seed"
psql_docker -f - <"$SQL_DIR/01_seed.sql" | tee "$OUT_DIR/01_seed.log"

# Write bench/.env.bench for k6
IDS="$(psql_docker -At -c "
SELECT
  'EVENT_ID=' || e.id || E'\n' ||
  'EVENT_SLUG=' || e.slug || E'\n' ||
  'TICKET_TYPE_ID=' || t.id || E'\n' ||
  'TICKET_QUANTITY=' || t.quantity
FROM events e
JOIN ticket_types t ON t.event_id = e.id
WHERE e.slug = 'bench-hot-path';
")"
printf '%s\n' "$IDS" >"$ROOT/bench/.env.bench"
echo "Wrote bench/.env.bench:"
cat "$ROOT/bench/.env.bench"

echo "==> EXPLAIN baselines"
psql_docker -f - <"$SQL_DIR/02_explain_availability.sql" | tee "$OUT_DIR/02_explain.log"

echo "==> Clearing previous bench-live holds"
psql_docker -f - <"$SQL_DIR/04_reset.sql" >/dev/null

echo "==> Contention: ${WORKERS} parallel bookers"
START="$(date +%s)"
OK=0
FAIL=0
PIDS=()
for i in $(seq 1 "$WORKERS"); do
  (
    if psql_docker -v "worker=w${i}-$$" -f - <"$SQL_DIR/03_contention_book.sql" \
      >"$OUT_DIR/worker-${i}.log" 2>&1; then
      echo OK >"$OUT_DIR/worker-${i}.status"
    else
      echo FAIL >"$OUT_DIR/worker-${i}.status"
    fi
  ) &
  PIDS+=($!)
done

# Optional lock snapshot mid-flight
sleep 0.2
psql_docker -f - <"$SQL_DIR/05_locks_snapshot.sql" >"$OUT_DIR/05_locks_mid.log" 2>&1 || true

for pid in "${PIDS[@]}"; do
  wait "$pid" || true
done
END="$(date +%s)"

for i in $(seq 1 "$WORKERS"); do
  if [[ -f "$OUT_DIR/worker-${i}.status" ]] && grep -q OK "$OUT_DIR/worker-${i}.status"; then
    OK=$((OK + 1))
  else
    FAIL=$((FAIL + 1))
  fi
done

echo "==> Correctness / remaining capacity"
psql_docker -f - <"$SQL_DIR/06_correctness.sql" | tee "$OUT_DIR/06_correctness.log"

{
  echo "workers=$WORKERS"
  echo "ok=$OK"
  echo "fail=$FAIL"
  echo "wall_seconds=$((END - START))"
} | tee "$OUT_DIR/summary.txt"

echo ""
echo "Done. Logs in bench/out/. Expect ok <= TICKET_QUANTITY (50) and active_reserved <= capacity."
echo "Next: inspect 02_explain.log and 05_locks_mid.log — see bench/README.md"
