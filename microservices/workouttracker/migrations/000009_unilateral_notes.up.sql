-- Per-limb weights for unilateral exercises. Both columns are set together
-- or not at all; the canonical `weight` column stays NOT NULL and holds
-- MIN(weight_left, weight_right) for unilateral sets (the weak limb governs
-- double progression and e1RM).
ALTER TABLE workout_sets
    ADD COLUMN weight_left numeric(7,2),
    ADD COLUMN weight_right numeric(7,2);

ALTER TABLE workout_sets
    ADD CONSTRAINT workout_sets_weight_left_check CHECK (weight_left >= 0),
    ADD CONSTRAINT workout_sets_weight_right_check CHECK (weight_right >= 0),
    ADD CONSTRAINT workout_sets_weight_pair_check CHECK ((weight_left IS NULL) = (weight_right IS NULL));

-- Laterality is a property of the movement, not the program: it lives on the
-- shared exercise catalog. Note the catalog's `isolation` type is a
-- different concept (single-joint) — do not overload it.
ALTER TABLE exercises
    ADD COLUMN laterality text NOT NULL DEFAULT 'bilateral';

ALTER TABLE exercises
    ADD CONSTRAINT exercises_laterality_check CHECK (laterality IN ('bilateral', 'unilateral'));

-- Conservative, idempotent seed for obviously unilateral catalog rows;
-- anything missed is a one-tap fix in the library console.
UPDATE exercises
SET laterality = 'unilateral'
WHERE name ~* 'single[ -]?leg|single[ -]?arm|one[ -]?arm|split squat|bulgarian|lunge|step[ -]?up|pistol';

-- Per-(session, exercise) notes: "Panatta taken, used Lifefitness at 45 kg"
-- is a fact about a session, so only a dated note keeps the note-weight-date
-- join intact. The composite PK makes offline replays an idempotent upsert.
CREATE TABLE workout_exercise_notes (
    workout_session_id bigint NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
    exercise_id bigint NOT NULL REFERENCES exercises(id),
    note text NOT NULL,
    created_at timestamp(0) with time zone NOT NULL DEFAULT now(),
    version integer NOT NULL DEFAULT 1,
    PRIMARY KEY (workout_session_id, exercise_id)
);

CREATE INDEX idx_workout_exercise_notes_exercise_id ON workout_exercise_notes(exercise_id);
