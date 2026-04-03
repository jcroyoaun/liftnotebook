CREATE EXTENSION IF NOT EXISTS citext;

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

CREATE INDEX IF NOT EXISTS idx_exercises_movement_pattern_id
    ON exercises(movement_pattern_id);

CREATE TABLE IF NOT EXISTS exercise_muscles (
    exercise_id bigint NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    muscle_id bigint NOT NULL REFERENCES muscles(id) ON DELETE CASCADE,
    created_at timestamp(0) with time zone NOT NULL DEFAULT now(),
    target_type target_type_enum NOT NULL,
    version integer NOT NULL DEFAULT 1,
    PRIMARY KEY (exercise_id, muscle_id)
);

CREATE INDEX IF NOT EXISTS idx_exercise_muscles_muscle_id
    ON exercise_muscles(muscle_id);

CREATE TABLE IF NOT EXISTS users (
    id bigserial PRIMARY KEY,
    created_at timestamp(0) with time zone NOT NULL DEFAULT now(),
    name text NOT NULL,
    email citext NOT NULL UNIQUE,
    password_hash bytea NOT NULL,
    activated boolean NOT NULL DEFAULT false,
    version integer NOT NULL DEFAULT 1
);
