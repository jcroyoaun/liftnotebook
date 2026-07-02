-- WARNING: this reverses the baseline schema and DESTROYS ALL DATA.
-- It exists only so the migration set is complete; never run it in production.

DROP TABLE IF EXISTS workout_sets;
DROP TABLE IF EXISTS workout_sessions;
DROP TABLE IF EXISTS training_day_exercises;
DROP TABLE IF EXISTS training_days;
DROP TABLE IF EXISTS mesocycles;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS exercise_muscles;
DROP TABLE IF EXISTS exercises;
DROP TABLE IF EXISTS movement_patterns;
DROP TABLE IF EXISTS muscles;

DROP TYPE IF EXISTS target_type_enum;
DROP TYPE IF EXISTS exercise_type_enum;
DROP TYPE IF EXISTS body_part_enum;
