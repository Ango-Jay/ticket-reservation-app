-- One booking attempt mirroring ReservationsService.create (SQL-only).
-- Parallelized by run-sql-bench.sh. Pass -v worker=unique-id

\set ON_ERROR_STOP on

SELECT set_config(
  'bench.worker',
  COALESCE(NULLIF(:'worker', ''), md5(random()::text)),
  false
);

BEGIN;

SELECT id, quantity
FROM ticket_types
WHERE id = (
  SELECT t.id
  FROM ticket_types t
  JOIN events e ON e.id = t.event_id
  WHERE e.slug = 'bench-hot-path'
  LIMIT 1
)
FOR UPDATE;

DO $$
DECLARE
  tt_id uuid;
  ev_id uuid;
  q int;
  reserved int;
  worker text := current_setting('bench.worker');
BEGIN
  SELECT t.id, t.event_id, t.quantity
  INTO tt_id, ev_id, q
  FROM ticket_types t
  JOIN events e ON e.id = t.event_id
  WHERE e.slug = 'bench-hot-path'
  LIMIT 1;

  SELECT COALESCE(SUM(r.quantity), 0) INTO reserved
  FROM reservations r
  WHERE r.ticket_type_id = tt_id
    AND (
      r.status = 'confirmed'
      OR (r.status = 'held' AND r.expires_at > now())
    );

  IF reserved + 1 > q THEN
    RAISE EXCEPTION 'not enough tickets available (reserved=%, quantity=%)', reserved, q
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO reservations (
    event_id,
    ticket_type_id,
    reservation_number,
    email,
    quantity,
    status,
    expires_at
  )
  VALUES (
    ev_id,
    tt_id,
    'bench-live-' || worker || '-' || floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint,
    'worker-' || worker || '@bench.local',
    1,
    'held',
    now() + interval '30 minutes'
  );
END $$;

COMMIT;
