-- After a storm: active reserved must be <= ticket capacity (no oversell).

SELECT
  t.quantity AS capacity,
  COALESCE(SUM(
    CASE
      WHEN r.status = 'confirmed' THEN r.quantity
      WHEN r.status = 'held' AND r.expires_at > now() THEN r.quantity
      ELSE 0
    END
  ), 0) AS active_reserved,
  t.quantity - COALESCE(SUM(
    CASE
      WHEN r.status = 'confirmed' THEN r.quantity
      WHEN r.status = 'held' AND r.expires_at > now() THEN r.quantity
      ELSE 0
    END
  ), 0) AS remaining,
  COUNT(*) FILTER (WHERE r.reservation_number LIKE 'bench-live-%') AS live_hold_rows
FROM ticket_types t
JOIN events e ON e.id = t.event_id
LEFT JOIN reservations r ON r.ticket_type_id = t.id
WHERE e.slug = 'bench-hot-path'
GROUP BY t.id, t.quantity;
