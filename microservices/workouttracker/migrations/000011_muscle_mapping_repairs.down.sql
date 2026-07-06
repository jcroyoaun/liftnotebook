-- Reverse the audit repairs. By-name to match the up migration.

-- Remove every Upper Trapezius mapping, then the muscle itself.
DELETE FROM exercise_muscles em
USING muscles m
WHERE em.muscle_id = m.id AND m.name = 'Upper Trapezius';
DELETE FROM muscles WHERE name = 'Upper Trapezius';

-- Put the Machine Deadlift hamstring heads back to secondary.
UPDATE exercise_muscles em SET target_type = 'secondary'
FROM exercises e, muscles m
WHERE em.exercise_id = e.id AND em.muscle_id = m.id
  AND e.name = 'Machine Deadlift'
  AND m.name IN ('Semitendinosus', 'Semimembranosus');

-- Dumbbell Pullover back to compound.
UPDATE exercises SET type = 'compound' WHERE name = 'Dumbbell Pullover';

-- Delete the additive mapping rows this migration introduced (Upper Trapezius
-- rows are already gone above).
DELETE FROM exercise_muscles em
USING exercises e, muscles m,
  (VALUES
    ('Underhand Pull-up (Chin-up)', 'Rhomboids'),
    ('Underhand Pull-up (Chin-up)', 'Middle Trapezius'),
    ('Underhand Pull-up (Chin-up)', 'Brachialis'),
    ('Weighted Chin-up',            'Rhomboids'),
    ('Weighted Chin-up',            'Middle Trapezius'),
    ('Weighted Chin-up',            'Brachialis'),
    ('Front Foot Elevated Split Squat', 'Vastus Lateralis'),
    ('Front Foot Elevated Split Squat', 'Vastus Medialis'),
    ('Front Foot Elevated Split Squat', 'Bicep Femoris'),
    ('Front Foot Elevated Split Squat', 'Semitendinosus'),
    ('Front Foot Elevated Split Squat', 'Semimembranosus'),
    ('Front Foot Elevated Split Squat', 'Erector Spinae'),
    ('Barbell Back Squat',          'Semitendinosus'),
    ('Barbell Back Squat',          'Semimembranosus'),
    ('Sumo Deadlift',               'Semitendinosus'),
    ('Sumo Deadlift',               'Semimembranosus'),
    ('Conventional Deadlift',       'Semitendinosus'),
    ('Conventional Deadlift',       'Semimembranosus'),
    ('Hip Thrust',                  'Semitendinosus'),
    ('Hip Thrust',                  'Semimembranosus'),
    ('SSB Bulgarian Split Squat (Front Foot Heel Elevated)', 'Semitendinosus'),
    ('SSB Bulgarian Split Squat (Front Foot Heel Elevated)', 'Semimembranosus'),
    ('Single Leg Leg Press',        'Semitendinosus'),
    ('Single Leg Leg Press',        'Semimembranosus'),
    ('Barbell Back Squat',          'Hip Adductors'),
    ('Barbell Front Squat',         'Hip Adductors'),
    ('Sumo Deadlift',               'Hip Adductors'),
    ('Sumo Deadlift',               'Forearm Flexors & Extensors'),
    ('Conventional Deadlift',       'Forearm Flexors & Extensors'),
    ('Deficit Straight Legged Deadlift', 'Forearm Flexors & Extensors'),
    ('Machine Deadlift',            'Forearm Flexors & Extensors'),
    ('Hammer Curls',                'Forearm Flexors & Extensors'),
    ('Lying Horizontal Bicep Curl', 'Brachialis'),
    ('Weighted 45-Degree Back Extension (Glute Focused)', 'Erector Spinae'),
    ('Cable Horizontal Row',        'Brachialis'),
    ('Cable Horizontal Row',        'Middle Trapezius'),
    ('T-Bar Row',                   'Posterior Deltoid')
  ) AS v(ex, mus)
WHERE em.exercise_id = e.id AND em.muscle_id = m.id
  AND e.name = v.ex AND m.name = v.mus;
