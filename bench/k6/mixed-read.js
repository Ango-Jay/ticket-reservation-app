/**
 * Read-heavy mix: list events + fetch by slug while the API is up.
 *
 * Env: BASE_URL, EVENT_SLUG (default bench-hot-path)
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';
const EVENT_SLUG = __ENV.EVENT_SLUG || 'bench-hot-path';

export const options = {
  stages: [
    { duration: '5s', target: 20 },
    { duration: '20s', target: 50 },
    { duration: '5s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<500'],
  },
};

export default function () {
  const list = http.get(`${BASE_URL}/events`, { tags: { name: 'list_events' } });
  check(list, { 'list 200': (r) => r.status === 200 });

  const one = http.get(`${BASE_URL}/events/slug/${EVENT_SLUG}`, {
    tags: { name: 'event_by_slug' },
  });
  check(one, { 'slug 200': (r) => r.status === 200 });

  sleep(0.1);
}
