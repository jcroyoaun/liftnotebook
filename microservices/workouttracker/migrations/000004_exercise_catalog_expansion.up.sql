-- Catalog expansion + mapping repairs. Everything here is by-name and
-- idempotent: on an already-seeded database it inserts what's missing; on a
-- fresh empty database (local dev runs migrations before seed.sql) every
-- statement no-ops and seed.sql provides the same rows with explicit ids.

-- New muscle for adduction work. Guarded on the seed baseline so an empty
-- muscles table stays empty (otherwise this row would steal id 1 and the
-- explicit-id seed inserts would silently ON CONFLICT away).
INSERT INTO muscles (name, body_part)
SELECT 'Hip Adductors', 'adductors'
WHERE EXISTS (SELECT 1 FROM muscles WHERE name = 'Pectoralis Major')
  AND NOT EXISTS (SELECT 1 FROM muscles WHERE name = 'Hip Adductors');

-- Repair: Hip Adduction Machine was mapped to the glute abductors.
DELETE FROM exercise_muscles em
USING exercises e, muscles m
WHERE em.exercise_id = e.id AND em.muscle_id = m.id
  AND e.name = 'Hip Adduction Machine'
  AND m.name IN ('Gluteus Medius', 'Gluteus Minimus');

-- New exercises (skipping any name that already exists).
INSERT INTO exercises (name, type, movement_pattern_id)
SELECT v.name, v.type::exercise_type_enum, mp.id
FROM (VALUES
    ('Machine Deadlift',                               'compound',  'Deadlift'),
    ('Machine Hip Press',                              'compound',  'Leg Press'),
    ('Pendulum Squat',                                 'compound',  'Leg Press'),
    ('Seated Leg Curl',                                'isolation', 'Isolation'),
    ('Machine Back Extension',                         'compound',  'Hip Hinge'),
    ('Single Leg Leg Press',                           'compound',  'Unilateral Leg Movement'),
    ('Machine Pullover',                               'isolation', 'Pull Over'),
    ('T-Bar Kelso Shrug',                              'isolation', 'Shrugs'),
    ('Incline Bench Cable Tricep Extension',           'isolation', 'Isolation'),
    ('Incline Bench Cable Overhead Tricep Extension',  'isolation', 'Isolation'),
    ('Bayesian Cable Curl',                            'isolation', 'Isolation'),
    ('Seated Bayesian Cable Curl',                     'isolation', 'Isolation'),
    ('Incline Bench Cable Pullover',                   'isolation', 'Pull Over'),
    ('Standing Cable Pullover',                        'isolation', 'Pull Over'),
    ('Single Leg Leg Extension',                       'isolation', 'Isolation'),
    ('Single Leg Leg Curl',                            'isolation', 'Isolation')
) AS v(name, type, pattern)
JOIN movement_patterns mp ON mp.name = v.pattern
WHERE NOT EXISTS (SELECT 1 FROM exercises e WHERE e.name = v.name);

-- Muscle targets for the new exercises, plus repairs for two exercises that
-- shipped with no mapping at all (they contributed zero volume): Dumbbell
-- Pullover and Hip Abductor Machine. Correct row for Hip Adduction Machine.
INSERT INTO exercise_muscles (exercise_id, muscle_id, target_type)
SELECT e.id, m.id, v.tt::target_type_enum
FROM (VALUES
    -- repairs
    ('Dumbbell Pullover',                              'Latissimus Dorsi',  'primary'),
    ('Dumbbell Pullover',                              'Pectoralis Major',  'secondary'),
    ('Dumbbell Pullover',                              'Triceps Brachii',   'secondary'),
    ('Hip Abductor Machine',                           'Gluteus Medius',    'primary'),
    ('Hip Abductor Machine',                           'Gluteus Minimus',   'primary'),
    ('Hip Adduction Machine',                          'Hip Adductors',     'primary'),
    -- new exercises
    ('Machine Deadlift',                               'Gluteus Maximus',   'primary'),
    ('Machine Deadlift',                               'Bicep Femoris',     'primary'),
    ('Machine Deadlift',                               'Erector Spinae',    'primary'),
    ('Machine Deadlift',                               'Latissimus Dorsi',  'secondary'),
    ('Machine Deadlift',                               'Middle Trapezius',  'secondary'),
    ('Machine Hip Press',                              'Gluteus Maximus',   'primary'),
    ('Machine Hip Press',                              'Rectus Femoris',    'secondary'),
    ('Machine Hip Press',                              'Vastus Lateralis',  'secondary'),
    ('Machine Hip Press',                              'Vastus Medialis',   'secondary'),
    ('Machine Hip Press',                              'Bicep Femoris',     'secondary'),
    ('Pendulum Squat',                                 'Rectus Femoris',    'primary'),
    ('Pendulum Squat',                                 'Vastus Lateralis',  'primary'),
    ('Pendulum Squat',                                 'Vastus Medialis',   'primary'),
    ('Pendulum Squat',                                 'Gluteus Maximus',   'secondary'),
    ('Seated Leg Curl',                                'Bicep Femoris',     'primary'),
    ('Seated Leg Curl',                                'Semitendinosus',    'primary'),
    ('Seated Leg Curl',                                'Semimembranosus',   'primary'),
    ('Machine Back Extension',                         'Erector Spinae',    'primary'),
    ('Machine Back Extension',                         'Gluteus Maximus',   'primary'),
    ('Machine Back Extension',                         'Bicep Femoris',     'secondary'),
    ('Machine Back Extension',                         'Semitendinosus',    'secondary'),
    ('Machine Back Extension',                         'Semimembranosus',   'secondary'),
    ('Single Leg Leg Press',                           'Rectus Femoris',    'primary'),
    ('Single Leg Leg Press',                           'Vastus Lateralis',  'primary'),
    ('Single Leg Leg Press',                           'Vastus Medialis',   'primary'),
    ('Single Leg Leg Press',                           'Gluteus Maximus',   'primary'),
    ('Single Leg Leg Press',                           'Bicep Femoris',     'secondary'),
    ('Machine Pullover',                               'Latissimus Dorsi',  'primary'),
    ('Machine Pullover',                               'Pectoralis Major',  'secondary'),
    ('Machine Pullover',                               'Triceps Brachii',   'secondary'),
    ('T-Bar Kelso Shrug',                              'Middle Trapezius',  'primary'),
    ('T-Bar Kelso Shrug',                              'Rhomboids',         'primary'),
    ('T-Bar Kelso Shrug',                              'Lower Trapezius',   'secondary'),
    ('Incline Bench Cable Tricep Extension',           'Triceps Brachii',   'primary'),
    ('Incline Bench Cable Overhead Tricep Extension',  'Triceps Brachii',   'primary'),
    ('Bayesian Cable Curl',                            'Biceps Brachii',    'primary'),
    ('Bayesian Cable Curl',                            'Brachialis',        'secondary'),
    ('Seated Bayesian Cable Curl',                     'Biceps Brachii',    'primary'),
    ('Seated Bayesian Cable Curl',                     'Brachialis',        'secondary'),
    ('Incline Bench Cable Pullover',                   'Latissimus Dorsi',  'primary'),
    ('Incline Bench Cable Pullover',                   'Pectoralis Major',  'secondary'),
    ('Incline Bench Cable Pullover',                   'Triceps Brachii',   'secondary'),
    ('Standing Cable Pullover',                        'Latissimus Dorsi',  'primary'),
    ('Standing Cable Pullover',                        'Pectoralis Major',  'secondary'),
    ('Standing Cable Pullover',                        'Triceps Brachii',   'secondary'),
    ('Single Leg Leg Extension',                       'Rectus Femoris',    'primary'),
    ('Single Leg Leg Extension',                       'Vastus Lateralis',  'primary'),
    ('Single Leg Leg Extension',                       'Vastus Medialis',   'primary'),
    ('Single Leg Leg Curl',                            'Bicep Femoris',     'primary'),
    ('Single Leg Leg Curl',                            'Semitendinosus',    'primary'),
    ('Single Leg Leg Curl',                            'Semimembranosus',   'primary')
) AS v(ex, mus, tt)
JOIN exercises e ON e.name = v.ex
JOIN muscles m ON m.name = v.mus
ON CONFLICT (exercise_id, muscle_id) DO NOTHING;
