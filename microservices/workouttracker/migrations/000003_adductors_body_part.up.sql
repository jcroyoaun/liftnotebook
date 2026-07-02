-- The catalog had no home for the inner thigh: Hip Adduction Machine was
-- mapped to the glute *abductors*. A dedicated body part fixes volume math
-- for adduction work. Enum extension lives alone in this migration so the
-- value is committed before 000004 uses it.
ALTER TYPE body_part_enum ADD VALUE IF NOT EXISTS 'adductors';
