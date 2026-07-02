DROP INDEX IF EXISTS workout_sets_client_id_idx;
ALTER TABLE workout_sets DROP COLUMN IF EXISTS client_id;

ALTER TABLE training_day_exercises ALTER COLUMN target_sets SET DEFAULT 3;

ALTER TABLE training_day_exercises
    DROP CONSTRAINT IF EXISTS training_day_exercises_rir_check,
    DROP CONSTRAINT IF EXISTS training_day_exercises_rep_range_check,
    DROP CONSTRAINT IF EXISTS training_day_exercises_rep_low_check;

ALTER TABLE training_day_exercises
    DROP COLUMN IF EXISTS target_rir,
    DROP COLUMN IF EXISTS target_rep_range_high,
    DROP COLUMN IF EXISTS target_rep_range_low;
