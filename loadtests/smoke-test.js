import http from 'k6/http';
import { sleep, check } from 'k6';

// Test Configuration
export const options = {
  stages: [
    // Ramp up to 5 users over 30 seconds
    { duration: '30s', target: 5 },
    // Stay at 5 users for 5 minutes
    { duration: '5m', target: 5 },
    // Ramp down to 0 users over 30 seconds
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    // We want 99% of requests to be successful (not 5xx or 4xx)
    'http_req_failed': ['rate<0.01'], 
    // We want 95% of requests to be under 500ms
    'http_req_duration': ['p(95)<500'], 
  },
};

// This is the main test function that each Virtual User (VU) will run in a loop.
export default function () {
  const baseUrl = 'https://exerciselib.liftnotebook.jcroyoaun.com';

  // --- User Journey: Browse Data ---

  // 1. Hit the healthcheck
  const healthRes = http.get(`${baseUrl}/v1/healthcheck`);
  check(healthRes, {
    'healthcheck is 200': (r) => r.status === 200,
  });

  sleep(Math.random() * 2 + 1); // Think for 1-3 seconds

  // 2. Get all exercises (the main one for our SLO)
  const exerciseRes = http.get(`${baseUrl}/v1/exercises`);
  check(exerciseRes, {
    'GET /v1/exercises is 200': (r) => r.status === 200,
  });

  sleep(Math.random() * 3 + 2); // Think for 2-5 seconds

  // 3. Get all muscles
  const muscleRes = http.get(`${baseUrl}/v1/muscles`);
  check(muscleRes, {
    'GET /v1/muscles is 200': (r) => r.status === 200,
  });

  sleep(Math.random() * 2 + 1); // Think for 1-3 seconds

  // 4. Get all movement patterns
  const patternRes = http.get(`${baseUrl}/v1/movement-patterns`);
  check(patternRes, {
    'GET /v1/movement-patterns is 200': (r) => r.status === 200,
  });

  sleep(Math.random() * 5 + 5); // Think for 5-10 seconds
}
