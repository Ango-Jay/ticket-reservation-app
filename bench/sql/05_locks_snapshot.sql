-- Quick lock / activity snapshot (run in another terminal while contention runs).

\echo === pg_stat_activity (non-idle) ===
SELECT pid, state, wait_event_type, wait_event, left(query, 80) AS query
FROM pg_stat_activity
WHERE datname = current_database()
  AND state <> 'idle'
  AND pid <> pg_backend_pid()
ORDER BY state;

\echo === Blocking locks (simplified) ===
SELECT
  blocked.pid AS blocked_pid,
  left(blocked.query, 60) AS blocked_query,
  blocking.pid AS blocking_pid,
  left(blocking.query, 60) AS blocking_query
FROM pg_stat_activity blocked
JOIN pg_locks bl ON bl.pid = blocked.pid AND NOT bl.granted
JOIN pg_locks hl
  ON hl.locktype = bl.locktype
  AND hl.database IS NOT DISTINCT FROM bl.database
  AND hl.relation IS NOT DISTINCT FROM bl.relation
  AND hl.page IS NOT DISTINCT FROM bl.page
  AND hl.tuple IS NOT DISTINCT FROM bl.tuple
  AND hl.virtualxid IS NOT DISTINCT FROM bl.virtualxid
  AND hl.transactionid IS NOT DISTINCT FROM bl.transactionid
  AND hl.classid IS NOT DISTINCT FROM bl.classid
  AND hl.objid IS NOT DISTINCT FROM bl.objid
  AND hl.objsubid IS NOT DISTINCT FROM bl.objsubid
  AND hl.pid <> bl.pid
  AND hl.granted
JOIN pg_stat_activity blocking ON blocking.pid = hl.pid
WHERE blocked.datname = current_database();
