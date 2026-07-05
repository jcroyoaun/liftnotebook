DROP INDEX IF EXISTS idx_workout_exercise_notes_exercise_id;
DROP TABLE IF EXISTS workout_exercise_notes;

ALTER TABLE exercises
    DROP CONSTRAINT IF EXISTS exercises_laterality_check;

ALTER TABLE exercises
    DROP COLUMN IF EXISTS laterality;

ALTER TABLE workout_sets
    DROP CONSTRAINT IF EXISTS workout_sets_weight_pair_check,
    DROP CONSTRAINT IF EXISTS workout_sets_weight_right_check,
    DROP CONSTRAINT IF EXISTS workout_sets_weight_left_check;

ALTER TABLE workout_sets
    DROP COLUMN IF EXISTS weight_right,
    DROP COLUMN IF EXISTS weight_left;
