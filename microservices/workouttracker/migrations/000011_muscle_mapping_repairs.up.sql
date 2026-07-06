-- Catalog audit repairs (2026-07-06). Every statement is BY NAME and
-- idempotent: on the already-seeded production DB it applies the corrections;
-- on a fresh empty DB (migrations run before seed.sql) every statement no-ops
-- and dumps/seed.sql provides the same corrected rows with explicit ids.
-- NOTE: exercise ids differ between prod and seed.sql — that is exactly why
-- this is by-name. Keep this file and dumps/seed.sql semantically identical.

-- New muscle: Upper Trapezius. The catalog had only Middle/Lower Trapezius,
-- so no lift credited the upper traps. Guarded on the seed baseline so a
-- fresh empty muscles table stays empty (seed.sql provides the explicit-id
-- row); otherwise this would steal an id the seed inserts expect.
INSERT INTO muscles (name, body_part)
SELECT 'Upper Trapezius', 'traps'
WHERE EXISTS (SELECT 1 FROM muscles WHERE name = 'Pectoralis Major')
  AND NOT EXISTS (SELECT 1 FROM muscles WHERE name = 'Upper Trapezius');

-- A pullover is single-joint (shoulder extension) — the three cable/machine
-- pullovers already ship as isolation; align the dumbbell one.
UPDATE exercises SET type = 'isolation' WHERE name = 'Dumbbell Pullover';

-- Machine Deadlift split the hamstring heads across tiers (biceps femoris
-- primary, the other two secondary). All three heads belong at one tier.
UPDATE exercise_muscles em SET target_type = 'primary'
FROM exercises e, muscles m
WHERE em.exercise_id = e.id AND em.muscle_id = m.id
  AND e.name = 'Machine Deadlift'
  AND m.name IN ('Semitendinosus', 'Semimembranosus');

-- All additive mapping fixes. ON CONFLICT DO NOTHING so a row already present
-- (prod/seed drift, re-runs) is left untouched; the two moves above are the
-- only tier changes.
INSERT INTO exercise_muscles (exercise_id, muscle_id, target_type)
SELECT e.id, m.id, v.tt::target_type_enum
FROM (VALUES
    -- Chin-ups had ZERO secondaries while every other vertical pull credits
    -- the rhomboids/mid-traps/brachialis assistance.
    ('Underhand Pull-up (Chin-up)', 'Rhomboids',                   'secondary'),
    ('Underhand Pull-up (Chin-up)', 'Middle Trapezius',            'secondary'),
    ('Underhand Pull-up (Chin-up)', 'Brachialis',                  'secondary'),
    ('Weighted Chin-up',            'Rhomboids',                   'secondary'),
    ('Weighted Chin-up',            'Middle Trapezius',            'secondary'),
    ('Weighted Chin-up',            'Brachialis',                  'secondary'),

    -- Front Foot Elevated Split Squat listed only rectus femoris for the
    -- quads and no secondaries — its sibling SSB Bulgarian is complete.
    ('Front Foot Elevated Split Squat', 'Vastus Lateralis',        'primary'),
    ('Front Foot Elevated Split Squat', 'Vastus Medialis',         'primary'),
    ('Front Foot Elevated Split Squat', 'Bicep Femoris',           'secondary'),
    ('Front Foot Elevated Split Squat', 'Semitendinosus',          'secondary'),
    ('Front Foot Elevated Split Squat', 'Semimembranosus',         'secondary'),
    ('Front Foot Elevated Split Squat', 'Erector Spinae',          'secondary'),

    -- Hamstring-head normalization: credit all three heads wherever the
    -- hamstrings were already credited at a tier (they were listed as just
    -- biceps femoris, skewing per-head volume).
    ('Barbell Back Squat',          'Semitendinosus',              'secondary'),
    ('Barbell Back Squat',          'Semimembranosus',             'secondary'),
    ('Sumo Deadlift',               'Semitendinosus',              'primary'),
    ('Sumo Deadlift',               'Semimembranosus',             'primary'),
    ('Conventional Deadlift',       'Semitendinosus',              'primary'),
    ('Conventional Deadlift',       'Semimembranosus',             'primary'),
    ('Hip Thrust',                  'Semitendinosus',              'secondary'),
    ('Hip Thrust',                  'Semimembranosus',             'secondary'),
    ('SSB Bulgarian Split Squat (Front Foot Heel Elevated)', 'Semitendinosus',  'secondary'),
    ('SSB Bulgarian Split Squat (Front Foot Heel Elevated)', 'Semimembranosus', 'secondary'),
    ('Single Leg Leg Press',        'Semitendinosus',              'secondary'),
    ('Single Leg Leg Press',        'Semimembranosus',             'secondary'),
    ('Machine Deadlift',            'Semitendinosus',              'primary'),
    ('Machine Deadlift',            'Semimembranosus',             'primary'),

    -- Adductors: adductor magnus is a real hip extensor in the deep bilateral
    -- squats, and the wide stance makes it a major mover in the sumo pull.
    ('Barbell Back Squat',          'Hip Adductors',               'secondary'),
    ('Barbell Front Squat',         'Hip Adductors',               'secondary'),
    ('Sumo Deadlift',               'Hip Adductors',               'secondary'),

    -- Grip is a genuine limiter on the loaded pulls and on hammer curls.
    ('Sumo Deadlift',               'Forearm Flexors & Extensors', 'secondary'),
    ('Conventional Deadlift',       'Forearm Flexors & Extensors', 'secondary'),
    ('Deficit Straight Legged Deadlift', 'Forearm Flexors & Extensors', 'secondary'),
    ('Machine Deadlift',            'Forearm Flexors & Extensors', 'secondary'),
    ('Hammer Curls',                'Forearm Flexors & Extensors', 'secondary'),

    -- Upper traps: scapular upward rotation in the press, isometric shoulder-
    -- girdle support in the deadlifts, and assistance on the Kelso shrug
    -- (whose mid-trap emphasis stays primary).
    ('Overhead Press',              'Upper Trapezius',             'secondary'),
    ('Sumo Deadlift',               'Upper Trapezius',             'secondary'),
    ('Conventional Deadlift',       'Upper Trapezius',             'secondary'),
    ('Machine Deadlift',            'Upper Trapezius',             'secondary'),
    ('T-Bar Kelso Shrug',           'Upper Trapezius',             'secondary'),

    -- Consistency fixes flagged in the audit.
    ('Lying Horizontal Bicep Curl', 'Brachialis',                 'secondary'),
    ('Weighted 45-Degree Back Extension (Glute Focused)', 'Erector Spinae', 'secondary'),
    ('Cable Horizontal Row',        'Brachialis',                  'secondary'),
    ('Cable Horizontal Row',        'Middle Trapezius',            'secondary'),
    ('T-Bar Row',                   'Posterior Deltoid',           'secondary')
) AS v(ex, mus, tt)
JOIN exercises e ON e.name = v.ex
JOIN muscles m ON m.name = v.mus
ON CONFLICT (exercise_id, muscle_id) DO NOTHING;
