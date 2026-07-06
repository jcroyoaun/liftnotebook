-- Seed data for exercise library
-- Movement patterns
INSERT INTO movement_patterns (id, name, description) VALUES
(1, 'Squat', 'Free weight Hip and knee flexion movement pattern performed with a barbell resting on the upper body'),
(2, 'Leg Press', 'Machine knee flexion movements pattern'),
(3, 'Deadlift', 'Free weight barbell loaded Hip flexion dominant movement pattern'),
(4, 'Hip Hinge', 'Hip flexion dominant movement pattern'),
(6, 'Vertical Pull', 'Pulling motion in vertical plane'),
(7, 'Vertical Push', 'Pushing motion in vertical plane'),
(8, 'Horizontal Pull', 'Pulling motion in horizontal plane'),
(9, 'Horizontal Push', 'Pushing motion in horizontal plane'),
(10, 'Horizontal Hip Extension', 'Hip extension in horizontal plane'),
(11, 'Pull Over', 'Arc motion bringing arms overhead'),
(12, 'Fly', 'Arc motion in horizontal plane'),
(13, 'Dips', 'Free weight dips performed on parallel bars'),
(14, 'Isolation', 'Single joint movement pattern'),
(15, 'Grip work', 'Movements aimed to improve forearm and grip strength'),
(16, 'Shrugs', 'Single joint movement pattern'),
(17, 'Unilateral Leg Movement', 'Single leg focused movement patterns')
ON CONFLICT (id) DO NOTHING;

SELECT setval('movement_patterns_id_seq', 17, true);

-- Muscles. The adductors body part postdates the enum's creation in older
-- schemas; adding it here keeps this seed runnable against any of them.
ALTER TYPE body_part_enum ADD VALUE IF NOT EXISTS 'adductors';

INSERT INTO muscles (id, name, body_part) VALUES
(1, 'Pectoralis Major', 'chest'),
(2, 'Pectoralis Minor', 'chest'),
(3, 'Latissimus Dorsi', 'back'),
(4, 'Rhomboids', 'back'),
(5, 'Middle Trapezius', 'traps'),
(6, 'Lower Trapezius', 'traps'),
(7, 'Erector Spinae', 'back'),
(8, 'Anterior Deltoid', 'shoulders'),
(9, 'Middle Deltoid', 'shoulders'),
(10, 'Posterior Deltoid', 'shoulders'),
(11, 'Biceps Brachii', 'biceps'),
(12, 'Triceps Brachii', 'triceps'),
(13, 'Brachialis', 'biceps'),
(14, 'Rectus Femoris', 'quadriceps'),
(15, 'Vastus Lateralis', 'quadriceps'),
(16, 'Vastus Medialis', 'quadriceps'),
(17, 'Bicep Femoris', 'hamstrings'),
(18, 'Semitendinosus', 'hamstrings'),
(19, 'Semimembranosus', 'hamstrings'),
(20, 'Gluteus Medius', 'glutes'),
(21, 'Gluteus Maximus', 'glutes'),
(22, 'Gluteus Minimus', 'glutes'),
(23, 'Gastrocnemius & Soleus', 'calves'),
(24, 'Rectus Abdominis', 'core'),
(25, 'Obliques', 'core'),
(26, 'Transverse Abdominis', 'core'),
(27, 'Forearm Flexors & Extensors', 'forearms'),
(28, 'Hip Adductors', 'adductors'),
(29, 'Upper Trapezius', 'traps')
ON CONFLICT (id) DO NOTHING;

SELECT setval('muscles_id_seq', 29, true);

-- Exercises
INSERT INTO exercises (id, name, type, movement_pattern_id) VALUES
(1, 'Barbell Back Squat', 'compound', 1),
(2, 'Barbell Front Squat', 'compound', 1),
(3, 'Sumo Deadlift', 'compound', 3),
(4, 'Conventional Deadlift', 'compound', 3),
(5, 'Deficit Straight Legged Deadlift', 'compound', 4),
(6, 'Overhand Pull-up', 'compound', 6),
(7, 'Underhand Pull-up (Chin-up)', 'compound', 6),
(8, 'Machine Row (Chest Supported)', 'compound', 8),
(9, 'Overhead Press', 'compound', 7),
(10, 'Lateral raises', 'isolation', 14),
(11, 'Flat Barbell Bench Press', 'compound', 9),
(12, 'Incline Barbell Bench Press', 'compound', 9),
(13, 'Machine Chest Press', 'compound', 9),
(14, 'Hip Thrust', 'compound', 10),
(15, 'Dumbbell Pullover', 'isolation', 11),
(16, 'Dumbbell Fly', 'isolation', 12),
(17, 'Preacher Bicep Curl', 'isolation', 14),
(18, 'Incline Bicep Curl', 'isolation', 14),
(19, 'Lying Horizontal Bicep Curl', 'isolation', 14),
(20, 'Cable Pushdown', 'isolation', 14),
(21, 'Overhead Tricep Extension', 'isolation', 14),
(22, 'Front Foot Elevated Split Squat', 'compound', 17),
(23, 'Hip Abductor Machine', 'isolation', 14),
(24, 'Seated Leg Extensions', 'isolation', 14),
(25, 'Lying Leg Curl', 'isolation', 14),
(26, 'Weighted 45-Degree Back Extension (Glute Focused)', 'compound', 4),
(27, 'Hack Squat', 'compound', 2),
(28, 'Leg Press', 'compound', 2),
(29, 'Hip Adduction Machine', 'isolation', 14),
(30, 'Glute Ham Raise', 'compound', 4),
(31, 'Machine Incline Chest Press', 'compound', 9),
(32, 'Cable Horizontal Row', 'compound', 8),
(33, 'Incline Bench Tricep Pushdown', 'isolation', 14),
(34, 'Machine Dips', 'compound', 13),
(35, 'Rear Delt Machine Reverse Fly', 'isolation', 14),
(36, 'Standing Machine Calf Raise', 'isolation', 14),
(37, 'Seated Calf Raise', 'isolation', 14),
(38, 'Standing Single Leg Calf Raise', 'isolation', 14),
(39, 'Wide Grip Pull-up', 'compound', 6),
(40, 'T-Bar Row', 'compound', 8),
(41, 'Hammer Curls', 'isolation', 14),
(42, 'Weighted Chin-up', 'compound', 6),
(43, 'SSB Bulgarian Split Squat (Front Foot Heel Elevated)', 'compound', 17),
(44, 'Machine Deadlift', 'compound', 3),
(45, 'Machine Hip Press', 'compound', 2),
(46, 'Pendulum Squat', 'compound', 2),
(47, 'Seated Leg Curl', 'isolation', 14),
(48, 'Machine Back Extension', 'compound', 4),
(49, 'Single Leg Leg Press', 'compound', 17),
(50, 'Machine Pullover', 'isolation', 11),
(51, 'T-Bar Kelso Shrug', 'isolation', 16),
(52, 'Incline Bench Cable Tricep Extension', 'isolation', 14),
(53, 'Incline Bench Cable Overhead Tricep Extension', 'isolation', 14),
(54, 'Bayesian Cable Curl', 'isolation', 14),
(55, 'Seated Bayesian Cable Curl', 'isolation', 14),
(56, 'Incline Bench Cable Pullover', 'isolation', 11),
(57, 'Standing Cable Pullover', 'isolation', 11),
(58, 'Single Leg Leg Extension', 'isolation', 14),
(59, 'Single Leg Leg Curl', 'isolation', 14)
ON CONFLICT (id) DO NOTHING;

SELECT setval('exercises_id_seq', 59, true);

-- Exercise-muscle relationships
INSERT INTO exercise_muscles (exercise_id, muscle_id, target_type) VALUES
-- Barbell Back Squat
(1, 14, 'primary'), (1, 15, 'primary'), (1, 16, 'primary'), (1, 21, 'primary'),
(1, 17, 'secondary'), (1, 7, 'secondary'),
-- Barbell Front Squat
(2, 14, 'primary'), (2, 15, 'primary'), (2, 16, 'primary'),
(2, 21, 'secondary'), (2, 7, 'secondary'),
-- Sumo Deadlift
(3, 21, 'primary'), (3, 17, 'primary'),
(3, 14, 'secondary'), (3, 7, 'secondary'), (3, 5, 'secondary'),
-- Conventional Deadlift
(4, 17, 'primary'), (4, 21, 'primary'), (4, 7, 'primary'),
(4, 3, 'secondary'), (4, 5, 'secondary'),
-- Deficit SLDL
(5, 17, 'primary'), (5, 18, 'primary'), (5, 19, 'primary'),
(5, 21, 'secondary'), (5, 7, 'secondary'),
-- Pull-up
(6, 3, 'primary'),
(6, 4, 'secondary'), (6, 5, 'secondary'), (6, 11, 'secondary'), (6, 10, 'secondary'),
-- Chin-up
(7, 3, 'primary'), (7, 11, 'primary'),
-- Machine Row
(8, 3, 'primary'), (8, 4, 'primary'),
(8, 5, 'secondary'), (8, 10, 'secondary'),
-- OHP
(9, 8, 'primary'), (9, 9, 'primary'),
(9, 12, 'secondary'),
-- Lateral raises
(10, 9, 'primary'),
-- Flat Bench
(11, 1, 'primary'),
(11, 8, 'secondary'), (11, 12, 'secondary'),
-- Incline Bench
(12, 1, 'primary'), (12, 8, 'primary'),
(12, 12, 'secondary'),
-- Machine Chest Press
(13, 1, 'primary'),
(13, 8, 'secondary'), (13, 12, 'secondary'),
-- Hip Thrust
(14, 21, 'primary'),
(14, 17, 'secondary'),
-- Dumbbell Pullover
(15, 3, 'primary'),
(15, 1, 'secondary'), (15, 12, 'secondary'),
-- Dumbbell Fly
(16, 1, 'primary'),
(16, 8, 'secondary'),
-- Preacher Curl
(17, 11, 'primary'),
(17, 13, 'secondary'),
-- Incline Curl
(18, 11, 'primary'),
(18, 13, 'secondary'),
-- Lying Curl
(19, 11, 'primary'),
-- Cable Pushdown
(20, 12, 'primary'),
-- Overhead Tricep Ext
(21, 12, 'primary'),
-- Split Squat
(22, 14, 'primary'), (22, 21, 'primary'),
-- Hip Abductor Machine
(23, 20, 'primary'), (23, 22, 'primary'),
-- Leg Extension
(24, 14, 'primary'), (24, 15, 'primary'), (24, 16, 'primary'),
-- Lying Leg Curl
(25, 17, 'primary'), (25, 18, 'primary'), (25, 19, 'primary'),
-- Weighted 45-Degree Back Extension (Glute Focused)
(26, 21, 'primary'),
(26, 17, 'secondary'), (26, 18, 'secondary'), (26, 19, 'secondary'),
-- Hack Squat
(27, 14, 'primary'), (27, 15, 'primary'), (27, 16, 'primary'),
(27, 21, 'secondary'),
-- Leg Press
(28, 14, 'primary'), (28, 15, 'primary'), (28, 16, 'primary'),
(28, 21, 'secondary'),
-- Hip Adduction Machine
(29, 28, 'primary'),
-- Glute Ham Raise
(30, 17, 'primary'), (30, 18, 'primary'), (30, 19, 'primary'),
(30, 21, 'secondary'),
-- Machine Incline Chest Press
(31, 1, 'primary'), (31, 8, 'primary'),
(31, 12, 'secondary'),
-- Cable Horizontal Row
(32, 3, 'primary'), (32, 4, 'primary'),
(32, 11, 'secondary'), (32, 10, 'secondary'),
-- Incline Bench Tricep Pushdown
(33, 12, 'primary'),
-- Machine Dips
(34, 1, 'primary'), (34, 12, 'primary'),
(34, 8, 'secondary'),
-- Rear Delt Machine Reverse Fly
(35, 10, 'primary'),
(35, 4, 'secondary'), (35, 5, 'secondary'),
-- Standing Machine Calf Raise
(36, 23, 'primary'),
-- Seated Calf Raise
(37, 23, 'primary'),
-- Standing Single Leg Calf Raise
(38, 23, 'primary'),
-- Wide Grip Pull-up
(39, 3, 'primary'),
(39, 4, 'secondary'), (39, 5, 'secondary'), (39, 10, 'secondary'),
-- T-Bar Row
(40, 3, 'primary'), (40, 4, 'primary'),
(40, 5, 'secondary'), (40, 11, 'secondary'), (40, 7, 'secondary'),
-- Hammer Curls
(41, 11, 'primary'), (41, 13, 'primary'),
-- Weighted Chin-up
(42, 3, 'primary'), (42, 11, 'primary'),
-- SSB Bulgarian Split Squat (Front Foot Heel Elevated)
(43, 14, 'primary'), (43, 15, 'primary'), (43, 16, 'primary'), (43, 21, 'primary'),
(43, 17, 'secondary'), (43, 7, 'secondary'),
-- Machine Deadlift
(44, 21, 'primary'), (44, 17, 'primary'), (44, 7, 'primary'),
(44, 3, 'secondary'), (44, 5, 'secondary'),
-- Machine Hip Press
(45, 21, 'primary'),
(45, 14, 'secondary'), (45, 15, 'secondary'), (45, 16, 'secondary'), (45, 17, 'secondary'),
-- Pendulum Squat
(46, 14, 'primary'), (46, 15, 'primary'), (46, 16, 'primary'),
(46, 21, 'secondary'),
-- Seated Leg Curl
(47, 17, 'primary'), (47, 18, 'primary'), (47, 19, 'primary'),
-- Machine Back Extension
(48, 7, 'primary'), (48, 21, 'primary'),
(48, 17, 'secondary'), (48, 18, 'secondary'), (48, 19, 'secondary'),
-- Single Leg Leg Press
(49, 14, 'primary'), (49, 15, 'primary'), (49, 16, 'primary'), (49, 21, 'primary'),
(49, 17, 'secondary'),
-- Machine Pullover
(50, 3, 'primary'),
(50, 1, 'secondary'), (50, 12, 'secondary'),
-- T-Bar Kelso Shrug
(51, 5, 'primary'), (51, 4, 'primary'),
(51, 6, 'secondary'),
-- Incline Bench Cable Tricep Extension
(52, 12, 'primary'),
-- Incline Bench Cable Overhead Tricep Extension
(53, 12, 'primary'),
-- Bayesian Cable Curl
(54, 11, 'primary'),
(54, 13, 'secondary'),
-- Seated Bayesian Cable Curl
(55, 11, 'primary'),
(55, 13, 'secondary'),
-- Incline Bench Cable Pullover
(56, 3, 'primary'),
(56, 1, 'secondary'), (56, 12, 'secondary'),
-- Standing Cable Pullover
(57, 3, 'primary'),
(57, 1, 'secondary'), (57, 12, 'secondary'),
-- Single Leg Leg Extension
(58, 14, 'primary'), (58, 15, 'primary'), (58, 16, 'primary'),
-- Single Leg Leg Curl
(59, 17, 'primary'), (59, 18, 'primary'), (59, 19, 'primary')
ON CONFLICT (exercise_id, muscle_id) DO NOTHING;

-- Muscle-mapping audit repairs (mirrors migration 000011). Seed exercise ids
-- differ from prod, so these reference seed's own ids; muscle ids are shared.
-- Upper Trapezius = 29, Semitendinosus = 18, Semimembranosus = 19,
-- Hip Adductors = 28, Forearm Flexors & Extensors = 27, Brachialis = 13.
INSERT INTO exercise_muscles (exercise_id, muscle_id, target_type) VALUES
-- Chin-ups: add the missing vertical-pull secondaries (rhomboids/mid-trap/brachialis)
(7, 4, 'secondary'), (7, 5, 'secondary'), (7, 13, 'secondary'),
(42, 4, 'secondary'), (42, 5, 'secondary'), (42, 13, 'secondary'),
-- Front Foot Elevated Split Squat: complete the quads + add hamstring/erector secondary
(22, 15, 'primary'), (22, 16, 'primary'),
(22, 17, 'secondary'), (22, 18, 'secondary'), (22, 19, 'secondary'), (22, 7, 'secondary'),
-- Hamstring-head normalization (credit all three heads at the existing tier)
(1, 18, 'secondary'), (1, 19, 'secondary'),
(3, 18, 'primary'), (3, 19, 'primary'),
(4, 18, 'primary'), (4, 19, 'primary'),
(14, 18, 'secondary'), (14, 19, 'secondary'),
(43, 18, 'secondary'), (43, 19, 'secondary'),
(49, 18, 'secondary'), (49, 19, 'secondary'),
(44, 18, 'primary'), (44, 19, 'primary'),
-- Adductors on the deep bilateral squats + sumo
(1, 28, 'secondary'), (2, 28, 'secondary'), (3, 28, 'secondary'),
-- Grip on the loaded pulls + hammer curls
(3, 27, 'secondary'), (4, 27, 'secondary'), (5, 27, 'secondary'),
(44, 27, 'secondary'), (41, 27, 'secondary'),
-- Upper traps: press, deadlift holds, Kelso shrug
(9, 29, 'secondary'), (3, 29, 'secondary'), (4, 29, 'secondary'),
(44, 29, 'secondary'), (51, 29, 'secondary'),
-- Consistency fixes
(19, 13, 'secondary'),
(26, 7, 'secondary'),
(32, 13, 'secondary'), (32, 5, 'secondary'),
(40, 10, 'secondary')
ON CONFLICT (exercise_id, muscle_id) DO NOTHING;

-- Laterality backfill (mirrors migration 000009): on fresh environments the
-- migration runs against an empty catalog, so the seed re-applies it. The
-- DO-block guard keeps this seed runnable against pre-000009 schemas.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'exercises' AND column_name = 'laterality') THEN
    UPDATE exercises SET laterality = 'unilateral'
    WHERE name ~* 'single[ -]?leg|single[ -]?arm|one[ -]?arm|split squat|bulgarian|lunge|step[ -]?up|pistol';
  END IF;
END $$;
