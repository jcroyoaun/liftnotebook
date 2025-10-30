import http from 'k6/http';
import { check } from 'k6';
// --- ⬇️ THIS IS THE CORRECT WAY TO IMPORT ⬇️ ---
import { randomItem } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

// --- Configuration ---
export const options = {
  insecureSkipTLSVerify: true, 
  
  // Same aggressive 10x ramp-up
  stages: [
    { duration: '2m', target: 100 },
    { duration: '2m', target: 200 },
    { duration: '2m', target: 300 },
    { duration: '2m', target: 400 },
    { duration: '2m', target: 500 },
    { duration: '1m', target: 0 },   
  ],

  thresholds: {
    'http_req_duration': ['p(95)<500'], // p95 < 500ms
    'http_req_failed': ['rate<0.01'],    // < 1% failure rate
  },
};

// --- Test Setup ---
const baseUrl = 'https://exerciselib.liftnotebook.jcroyoaun.com';

// An array of the main GET endpoints we want to hammer
const ENDPOINTS = [
  '/v1/exercises',
  '/v1/muscles',
  '/v1/movement-patterns',
];

// --- Main Test Function ---
// No sleep(). Just a non-stop loop of API calls.
export default function () {
  
  // Pick a random endpoint from the list
  const endpoint = randomItem(ENDPOINTS);

  // Send the request
  const res = http.get(`${baseUrl}${endpoint}`);
  
  // Check that it was successful
  check(res, {
    [`GET ${endpoint} is 200`]: (r) => r.status === 200,
  });
}
