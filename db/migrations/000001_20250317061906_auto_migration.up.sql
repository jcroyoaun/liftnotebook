CREATE TABLE IF NOT EXISTS exercises (
    id bigserial PRIMARY KEY,  
    created_at timestamp(0) with time zone NOT NULL DEFAULT NOW(),
    name text NOT NULL,
    primarymusclegroups text[] NOT NULL,
    secondarymusclegroups text[] NOT NULL,
    version integer NOT NULL DEFAULT 1
);
