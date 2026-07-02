-- Remove the exercises added in 000004 (mappings first), restore the old
-- Hip Adduction Machine mapping, and drop the Hip Adductors muscle.
DELETE FROM exercise_muscles em
USING exercises e
WHERE em.exercise_id = e.id
  AND e.name IN (
    'Machine Deadlift', 'Machine Hip Press', 'Pendulum Squat', 'Seated Leg Curl',
    'Machine Back Extension', 'Single Leg Leg Press', 'Machine Pullover',
    'T-Bar Kelso Shrug', 'Incline Bench Cable Tricep Extension',
    'Incline Bench Cable Overhead Tricep Extension', 'Bayesian Cable Curl',
    'Seated Bayesian Cable Curl', 'Incline Bench Cable Pullover',
    'Standing Cable Pullover', 'Single Leg Leg Extension', 'Single Leg Leg Curl'
  );

DELETE FROM exercises
WHERE name IN (
    'Machine Deadlift', 'Machine Hip Press', 'Pendulum Squat', 'Seated Leg Curl',
    'Machine Back Extension', 'Single Leg Leg Press', 'Machine Pullover',
    'T-Bar Kelso Shrug', 'Incline Bench Cable Tricep Extension',
    'Incline Bench Cable Overhead Tricep Extension', 'Bayesian Cable Curl',
    'Seated Bayesian Cable Curl', 'Incline Bench Cable Pullover',
    'Standing Cable Pullover', 'Single Leg Leg Extension', 'Single Leg Leg Curl'
);

DELETE FROM exercise_muscles em
USING exercises e, muscles m
WHERE em.exercise_id = e.id AND em.muscle_id = m.id
  AND e.name = 'Hip Adduction Machine' AND m.name = 'Hip Adductors';

INSERT INTO exercise_muscles (exercise_id, muscle_id, target_type)
SELECT e.id, m.id, 'primary'::target_type_enum
FROM exercises e, muscles m
WHERE e.name = 'Hip Adduction Machine'
  AND m.name IN ('Gluteus Medius', 'Gluteus Minimus')
ON CONFLICT (exercise_id, muscle_id) DO NOTHING;

DELETE FROM muscles WHERE name = 'Hip Adductors';
