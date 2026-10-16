-- Seed a scarce bench event + ticket type for contention experiments.
-- Also inserts historical rows so SUM/availability queries have volume.

BEGIN;

DELETE FROM reservations
WHERE event_id IN (SELECT id FROM events WHERE slug LIKE 'bench-%');

DELETE FROM ticket_types
WHERE event_id IN (SELECT id FROM events WHERE slug LIKE 'bench-%');

DELETE FROM events WHERE slug LIKE 'bench-%';

WITH ev AS (
  INSERT INTO events (
    title,
    slug,
    description,
    starts_at,
    expires_at,
    location,
    status
  )
  VALUES (
    'Bench Contention Event',
    'bench-hot-path',
    'Synthetic event for local SQL/HTTP benchmarks',
    now() + interval '30 days',
    NULL,
    'Benchmark Arena',
    'active'
  )
  RETURNING id, slug
),
tt AS (
  INSERT INTO ticket_types (event_id, name, price, currency, quantity)
  SELECT
    ev.id,
    'GA Bench',
    5000.00,
    'NGN',
    50
  FROM ev
  RETURNING id, event_id, quantity
)
SELECT
  ev.id AS event_id,
  ev.slug AS event_slug,
  tt.id AS ticket_type_id,
  tt.quantity AS ticket_quantity
INTO TEMP TABLE bench_seed
FROM ev, tt;

INSERT INTO reservations (
  event_id,
  ticket_type_id,
  reservation_number,
  email,
  quantity,
  status,
  expires_at
)
SELECT
  s.event_id,
  s.ticket_type_id,
  'bench-hist-' || g.i::text,
  'hist' || g.i::text || '@bench.local',
  1,
  -- expired/cancelled only: fattens the table for EXPLAIN without eating scarce capacity
  CASE WHEN g.i % 4 = 0 THEN 'cancelled' ELSE 'expired' END,
  now() - interval '1 hour'
FROM bench_seed s
CROSS JOIN generate_series(1, 2000) AS g(i);

COMMIT;

SELECT e.id AS event_id, e.slug, t.id AS ticket_type_id, t.quantity
FROM events e
JOIN ticket_types t ON t.event_id = e.id
WHERE e.slug = 'bench-hot-path';
