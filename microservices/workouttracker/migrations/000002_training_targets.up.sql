-- Per-exercise training targets for the progression engine. Defaults reflect
-- the house style: 2 working sets of 8-12 reps taken to failure (RIR 0).
ALTER TABLE training_day_exercises
    ADD COLUMN target_rep_range_low integer NOT NULL DEFAULT 8,
    ADD COLUMN target_rep_range_high integer NOT NULL DEFAULT 12,
    ADD COLUMN target_rir integer NOT NULL DEFAULT 0;

ALTER TABLE training_day_exercises
    ADD CONSTRAINT training_day_exercises_rep_low_check CHECK (target_rep_range_low >= 1),
    ADD CONSTRAINT training_day_exercises_rep_range_check CHECK (target_rep_range_high >= target_rep_range_low),
    ADD CONSTRAINT training_day_exercises_rir_check CHECK (target_rir BETWEEN 0 AND 10);

ALTER TABLE training_day_exercises ALTER COLUMN target_sets SET DEFAULT 2;

-- Client-generated UUID so offline clients can replay set logging safely:
-- the same client_id upserts instead of duplicating the set.
ALTER TABLE workout_sets ADD COLUMN client_id uuid;
CREATE UNIQUE INDEX workout_sets_client_id_idx ON workout_sets (client_id) WHERE client_id IS NOT NULL;
