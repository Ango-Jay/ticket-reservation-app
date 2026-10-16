/**
 * Concurrent POST /events/:eventId/reservations against scarce GA Bench inventory.
 *
 * Env (from bench/.env.bench + BASE_URL):
 *   BASE_URL, EVENT_ID, TICKET_TYPE_ID
 *
 * Run: ./bench/scripts/run-k6.sh hold-storm
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';
const EVENT_ID = __ENV.EVENT_ID;
const TICKET_TYPE_ID = __ENV.TICKET_TYPE_ID;

if (!EVENT_ID || !TICKET_TYPE_ID) {
  throw new Error('EVENT_ID and TICKET_TYPE_ID are required (run bench:sql seed first)');
}

const conflictRate = new Rate('reservation_conflicts');
const created = new Counter('reservations_created');
const latency = new Trend('reservation_create_ms', true);

export const options = {
  stages: [
    { duration: '5s', target: 10 },
    { duration: '15s', target: 40 },
    { duration: '10s', target: 40 },
    { duration: '5s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.95'], // many 409s expected once sold out — not "failures" only
    reservation_create_ms: ['p(95)<2000'],
  },
};

export default function () {
  const email = `k6-${__VU}-${__ITER}-${Date.now()}@bench.local`;
  const res = http.post(
    `${BASE_URL}/events/${EVENT_ID}/reservations`,
    JSON.stringify({
      email,
      ticketTypeId: TICKET_TYPE_ID,
      quantity: 1,
    }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'create_reservation' },
    },
  );

  latency.add(res.timings.duration);

  const ok = check(res, {
    'status is 201 or 409 or 200': (r) =>
      r.status === 201 || r.status === 200 || r.status === 409,
  });

  if (res.status === 201 || res.status === 200) {
    created.add(1);
    conflictRate.add(0);
  } else if (res.status === 409) {
    conflictRate.add(1);
  } else {
    conflictRate.add(0);
    if (!ok) {
      console.error(`unexpected ${res.status}: ${res.body}`);
    }
  }

  sleep(0.05);
}
