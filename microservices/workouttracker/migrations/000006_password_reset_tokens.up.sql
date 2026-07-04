-- One-time password-reset codes. Sessions stay stateless (JWT); this table
-- only holds hashed reset codes handed out by an admin, so it stays tiny.
CREATE TABLE IF NOT EXISTS tokens (
    hash bytea PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    expiry timestamptz NOT NULL,
    scope text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tokens_user_id ON tokens (user_id);
