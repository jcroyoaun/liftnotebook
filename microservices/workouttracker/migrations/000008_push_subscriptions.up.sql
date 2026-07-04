-- Web-push subscriptions for rest-timer notifications. One row per
-- browser/device endpoint; endpoint is globally unique per the Push API.
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id bigserial PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    endpoint text NOT NULL UNIQUE,
    p256dh text NOT NULL,
    auth text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id
    ON push_subscriptions (user_id);
