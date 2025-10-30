import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  // Just run it 5 times. This isn't a load test, it's a *functional* test.
  iterations: 5,
  vus: 1,
};

const baseUrl = 'https://exerciselib.liftnotebook.jcroyoaun.com';

// Helper function to create the JSON payload
function newExercisePayload() {
  // Use a random name to make sure it's unique every time
  const randomName = `k6 Test Exercise ${Math.floor(Math.random() * 10000)}`;
  return JSON.stringify({
    name: randomName,
    type: 'compound',
    movement_pattern_id: 1, // Assumes 'Squat' with ID 1 exists
    primary_muscles: [21],   // Assumes 'Gluteus Maximus' with ID 21 exists
    secondary_muscles: [7],  // Assumes 'Erector Spinae' with ID 7 exists
  });
}

export default function () {
  const headers = { 'Content-Type': 'application/json' };
  
  // ----------------------------------------------------
  // 1. CREATE Exercise (POST)
  // ----------------------------------------------------
  const createRes = http.post(
    `${baseUrl}/v1/exercises`,
    newExercisePayload(),
    { headers: headers }
  );
  
  check(createRes, {
    'POST /v1/exercises is 201 Created': (r) => r.status === 201,
  });

  // Try to get the ID of the new exercise from the response body
  let newExerciseID = 0;
  try {
    newExerciseID = createRes.json('exercise.id');
  } catch (e) {
    console.error('Failed to parse exercise ID from creation response');
  }

  // If we didn't get an ID, stop this user's test
  if (!newExerciseID) {
    console.error(`Failed to create exercise. Status: ${createRes.status} Body: ${createRes.body}`);
    return; 
  }

  console.log(`Successfully created exercise ${newExerciseID}`);
  sleep(2); // Wait 2 seconds

  // ----------------------------------------------------
  // 2. (Optional) VERIFY Exercise (GET)
  // ----------------------------------------------------
  const getRes = http.get(`${baseUrl}/v1/exercises/${newExerciseID}`);
  check(getRes, {
    'GET /v1/exercises/:id is 200': (r) => r.status === 200,
  });
  
  sleep(2); // Wait 2 seconds

  // ----------------------------------------------------
  // 3. DELETE Exercise (DELETE)
  // ----------------------------------------------------
  const deleteRes = http.del(`${baseUrl}/v1/exercises/${newExerciseID}`);
  check(deleteRes, {
    'DELETE /v1/exercises/:id is 200': (r) => r.status === 200,
  });

  console.log(`Successfully deleted exercise ${newExerciseID}`);
  sleep(5); // Wait 5 seconds before the next test run
}
