import http from 'k6/http';
import { sleep, check } from 'k6';

// --- THIS IS THE ONLY PART THAT CHANGES ---
export const options = {
  // We'll skip TLS verification if your cert is self-signed
  insecureSkipTLSVerify: true, 
  
  // This test will ramp up VUs in steps to find the breaking point
  stages: [
    { duration: '2m', target: 10 },  // 1. Ramp up to 10 VUs and hold for 2 minutes
    { duration: '2m', target: 20 },  // 2. Ramp up to 20 VUs and hold for 2 minutes
    { duration: '2m', target: 30 },  // 3. Ramp up to 30 VUs and hold for 2 minutes
    { duration: '2m', target: 40 },  // 4. Ramp up to 40 VUs and hold for 2 minutes
    { duration: '2m', target: 50 },  // 5. Ramp up to 50 VUs and hold for 2 minutes
    // ...you can keep adding stages here to go higher...
    { duration: '1m', target: 0 },   // 6. Ramp down
  ],

  thresholds: {
    // Fail the test if p95 latency goes above 500ms
    'http_req_duration': ['p(95)<500'],
    // Fail the test if more than 1% of requests fail
    'http_req_failed': ['rate<0.01'], 
  },
};
// --- END OF CHANGES ---


// This is the same user journey from smoke-test.js
export default function () {
  const baseUrl = 'https://exerciselib.liftnotebook.jcroyoaun.com';

  const healthRes = http.get(`${baseUrl}/v1/healthcheck`);
  check(healthRes, { 'healthcheck is 200': (r) => r.status === 200 });

  sleep(Math.random() * 2 + 1); 

  const exerciseRes = http.get(`${baseUrl}/v1/exercises`);
  check(exerciseRes, { 'GET /v1/exercises is 200': (r) => r.status === 200 });

  sleep(Math.random() * 3 + 2); 

  const muscleRes = http.get(`${baseUrl}/v1/muscles`);
  check(muscleRes, { 'GET /v1/muscles is 200': (r) => r.status === 200 });

  sleep(Math.random() * 2 + 1); 

  const patternRes = http.get(`${baseUrl}/v1/movement-patterns`);
  check(patternRes, { 'GET /v1/movement-patterns is 200': (r) => r.status === 200 });

  sleep(Math.random() * 5 + 5); 
}
