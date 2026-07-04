-- Admin-authored program templates: global (not user-owned) blueprints that
-- any user can clone into their own mesocycle. Mirrors the
-- mesocycles/training_days/training_day_exercises shape.
CREATE TABLE IF NOT EXISTS program_templates (
    id bigserial PRIMARY KEY,
    created_at timestamptz NOT NULL DEFAULT now(),
    name text NOT NULL,
    description text NOT NULL DEFAULT '',
    days_per_week integer NOT NULL CHECK (days_per_week BETWEEN 1 AND 7),
    created_by bigint REFERENCES users (id) ON DELETE SET NULL,
    version integer NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS template_days (
    id bigserial PRIMARY KEY,
    template_id bigint NOT NULL REFERENCES program_templates (id) ON DELETE CASCADE,
    day_number integer NOT NULL CHECK (day_number >= 1),
    label text NOT NULL,
    UNIQUE (template_id, day_number)
);

CREATE TABLE IF NOT EXISTS template_day_exercises (
    id bigserial PRIMARY KEY,
    template_day_id bigint NOT NULL REFERENCES template_days (id) ON DELETE CASCADE,
    exercise_id bigint NOT NULL REFERENCES exercises (id),
    position integer NOT NULL,
    target_sets integer NOT NULL DEFAULT 2 CHECK (target_sets >= 1),
    target_rep_range_low integer NOT NULL DEFAULT 8 CHECK (target_rep_range_low >= 1),
    target_rep_range_high integer NOT NULL DEFAULT 12,
    target_rir integer NOT NULL DEFAULT 0 CHECK (target_rir BETWEEN 0 AND 10),
    UNIQUE (template_day_id, position),
    CHECK (target_rep_range_high >= target_rep_range_low)
);

CREATE INDEX IF NOT EXISTS idx_template_days_template_id
    ON template_days (template_id);
CREATE INDEX IF NOT EXISTS idx_template_day_exercises_day_id
    ON template_day_exercises (template_day_id);
