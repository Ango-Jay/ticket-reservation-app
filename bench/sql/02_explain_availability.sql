-- Baseline EXPLAIN plans for hot paths (uses bench-hot-path seed).

\set ON_ERROR_STOP on

\echo === SUM reserved (mirrors getSumOfReservedForTicketType) ===
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT COALESCE(SUM(r.quantity), 0) AS reserved
FROM reservations r
WHERE r.ticket_type_id = (
  SELECT t.id
  FROM ticket_types t
  JOIN events e ON e.id = t.event_id
  WHERE e.slug = 'bench-hot-path'
  LIMIT 1
)
  AND (
    r.status = 'confirmed'
    OR (r.status = 'held' AND r.expires_at > now())
  );

\echo === Partial index: held expires_at scan ===
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT r.id, r.expires_at
FROM reservations r
WHERE r.status = 'held'
  AND r.expires_at <= now()
ORDER BY r.expires_at
LIMIT 100;

\echo === Lookup by reservation_number (unique) ===
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT *
FROM reservations r
WHERE r.reservation_number = 'bench-hist-1';

\echo === Lookup event by slug (unique) ===
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT *
FROM events e
WHERE e.slug = 'bench-hot-path';

\echo === Active events list (status index) ===
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT e.id, e.title, e.slug
FROM events e
WHERE e.status = 'active'
ORDER BY e.updated_at DESC
LIMIT 20;
