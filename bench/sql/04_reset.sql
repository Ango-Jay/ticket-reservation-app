-- Delete live bench holds from a previous storm (keeps bench-hist-* seed rows).

DELETE FROM reservations
WHERE reservation_number LIKE 'bench-live-%';
