-- Training weeks are USER-defined, never calendar-anchored (owner's law:
-- "my week ends when I say so"). A block carries a current_week counter the
-- lifter advances explicitly; every session is stamped with the week it was
-- logged in. Nothing anywhere may bucket workouts by Monday again.

ALTER TABLE mesocycles ADD COLUMN current_week integer NOT NULL DEFAULT 1;
ALTER TABLE workout_sessions ADD COLUMN week_number integer NOT NULL DEFAULT 1;

-- Backfill: dense-rank each session's old Monday bucket per block so history
-- keeps exactly the weekly buckets the calendar logic used to display.
WITH ranked AS (
    SELECT id,
           DENSE_RANK() OVER (
               PARTITION BY mesocycle_id
               ORDER BY date_trunc('week', performed_at)
           ) AS wk
    FROM workout_sessions
)
UPDATE workout_sessions ws
SET week_number = ranked.wk
FROM ranked
WHERE ws.id = ranked.id;

UPDATE mesocycles m
SET current_week = COALESCE(
    (SELECT MAX(week_number) FROM workout_sessions ws WHERE ws.mesocycle_id = m.id),
    1
);
