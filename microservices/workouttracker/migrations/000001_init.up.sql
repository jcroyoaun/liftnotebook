-- Extensions
CREATE EXTENSION IF NOT EXISTS citext;

-- Enums (shared with exerciselib)
DO $$ BEGIN
    CREATE TYPE body_part_enum AS ENUM (
        'chest','back','shoulders','biceps','triceps',
        'quadriceps','hamstrings','glutes','calves','core','forearms','traps'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE exercise_type_enum AS ENUM ('compound','isolation');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE target_type_enum AS ENUM ('primary','secondary');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Exerciselib tables (created if not exist, for shared DB)
CREATE TABLE IF NOT EXISTS muscles (
    id bigserial PRIMARY KEY,
    created_at timestamp(0) with time zone NOT NULL DEFAULT now(),
    name varchar(100) NOT NULL UNIQUE,
    body_part body_part_enum NOT NULL,
    version integer NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS movement_patterns (
    id bigserial PRIMARY KEY,
    created_at timestamp(0) with time zone NOT NULL DEFAULT now(),
    name text NOT NULL,
    description text,
    version integer NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS exercises (
    id bigserial PRIMARY KEY,
    created_at timestamp(0) with time zone NOT NULL DEFAULT now(),
    name text NOT NULL,
    type exercise_type_enum NOT NULL,
    movement_pattern_id bigint NOT NULL REFERENCES movement_patterns(id),
    version integer NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_exercises_movement_pattern_id ON exercises(movement_pattern_id);

CREATE TABLE IF NOT EXISTS exercise_muscles (
    exercise_id bigint NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    muscle_id bigint NOT NULL REFERENCES muscles(id) ON DELETE CASCADE,
    created_at timestamp(0) with time zone NOT NULL DEFAULT now(),
    target_type target_type_enum NOT NULL,
    version integer NOT NULL DEFAULT 1,
    PRIMARY KEY (exercise_id, muscle_id)
);

CREATE INDEX IF NOT EXISTS idx_exercise_muscles_muscle_id ON exercise_muscles(muscle_id);

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id bigserial PRIMARY KEY,
    created_at timestamp(0) with time zone NOT NULL DEFAULT now(),
    name text NOT NULL,
    email citext NOT NULL UNIQUE,
    password_hash bytea NOT NULL,
    activated boolean NOT NULL DEFAULT false,
    version integer NOT NULL DEFAULT 1
);

-- =============================================
-- Workout Tracker tables
-- =============================================

CREATE TABLE IF NOT EXISTS mesocycles (
    id bigserial PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name text NOT NULL,
    days_per_week integer NOT NULL CHECK (days_per_week BETWEEN 1 AND 7),
    started_at timestamp(0) with time zone NOT NULL DEFAULT now(),
    ended_at timestamp(0) with time zone,
    created_at timestamp(0) with time zone NOT NULL DEFAULT now(),
    version integer NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_mesocycles_user_id ON mesocycles(user_id);

CREATE TABLE IF NOT EXISTS training_days (
    id bigserial PRIMARY KEY,
    mesocycle_id bigint NOT NULL REFERENCES mesocycles(id) ON DELETE CASCADE,
    day_number integer NOT NULL CHECK (day_number >= 1),
    label text NOT NULL,
    created_at timestamp(0) with time zone NOT NULL DEFAULT now(),
    version integer NOT NULL DEFAULT 1,
    UNIQUE(mesocycle_id, day_number)
);

CREATE TABLE IF NOT EXISTS training_day_exercises (
    id bigserial PRIMARY KEY,
    training_day_id bigint NOT NULL REFERENCES training_days(id) ON DELETE CASCADE,
    exercise_id bigint NOT NULL REFERENCES exercises(id),
    position integer NOT NULL,
    target_sets integer NOT NULL DEFAULT 3 CHECK (target_sets >= 1),
    created_at timestamp(0) with time zone NOT NULL DEFAULT now(),
    version integer NOT NULL DEFAULT 1,
    UNIQUE(training_day_id, position)
);

CREATE TABLE IF NOT EXISTS workout_sessions (
    id bigserial PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mesocycle_id bigint NOT NULL REFERENCES mesocycles(id),
    training_day_id bigint NOT NULL REFERENCES training_days(id),
    performed_at timestamp(0) with time zone NOT NULL DEFAULT now(),
    notes text,
    created_at timestamp(0) with time zone NOT NULL DEFAULT now(),
    version integer NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_workout_sessions_user_id ON workout_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_workout_sessions_mesocycle_id ON workout_sessions(mesocycle_id);

CREATE TABLE IF NOT EXISTS workout_sets (
    id bigserial PRIMARY KEY,
    workout_session_id bigint NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
    exercise_id bigint NOT NULL REFERENCES exercises(id),
    set_number integer NOT NULL CHECK (set_number >= 1),
    weight numeric(7,2) NOT NULL CHECK (weight >= 0),
    reps integer NOT NULL CHECK (reps >= 1),
    rir integer CHECK (rir >= 0 AND rir <= 10),
    recorded boolean NOT NULL DEFAULT false,
    created_at timestamp(0) with time zone NOT NULL DEFAULT now(),
    version integer NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_workout_sets_session_id ON workout_sets(workout_session_id);
CREATE INDEX IF NOT EXISTS idx_workout_sets_exercise_id ON workout_sets(exercise_id);
