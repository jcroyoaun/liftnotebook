-- Role column for the shared user hierarchy: exercise-catalog writes are
-- gated on role='admin' (validated from the JWT by exerciselib). Promotion
-- happens at API startup from the ADMIN_EMAILS env, never by user request.
ALTER TABLE users ADD COLUMN role text NOT NULL DEFAULT 'user';
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('user', 'admin'));
