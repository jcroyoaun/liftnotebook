package data

import (
	"context"
	"database/sql"
	"time"
)

type PushSubscription struct {
	ID       int64  `json:"id"`
	UserID   int64  `json:"-"`
	Endpoint string `json:"endpoint"`
	P256dh   string `json:"-"`
	Auth     string `json:"-"`
}

type PushSubscriptionModel struct {
	DB *sql.DB
}

// Upsert claims the endpoint for the user — a browser re-subscribing after a
// permission change gets its row refreshed instead of duplicated.
func (m PushSubscriptionModel) Upsert(sub *PushSubscription) error {
	query := `
		INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (endpoint) DO UPDATE
		SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth
		RETURNING id`

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	return m.DB.QueryRowContext(ctx, query, sub.UserID, sub.Endpoint, sub.P256dh, sub.Auth).Scan(&sub.ID)
}

func (m PushSubscriptionModel) Delete(userID int64, endpoint string) error {
	query := `DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2`

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	_, err := m.DB.ExecContext(ctx, query, userID, endpoint)
	return err
}

// DeleteByEndpoint prunes a subscription the push service reported dead
// (404/410) regardless of owner.
func (m PushSubscriptionModel) DeleteByEndpoint(endpoint string) error {
	query := `DELETE FROM push_subscriptions WHERE endpoint = $1`

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	_, err := m.DB.ExecContext(ctx, query, endpoint)
	return err
}

func (m PushSubscriptionModel) GetForUser(userID int64) ([]PushSubscription, error) {
	query := `
		SELECT id, user_id, endpoint, p256dh, auth
		FROM push_subscriptions
		WHERE user_id = $1`

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	rows, err := m.DB.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var subs []PushSubscription
	for rows.Next() {
		var sub PushSubscription
		err := rows.Scan(&sub.ID, &sub.UserID, &sub.Endpoint, &sub.P256dh, &sub.Auth)
		if err != nil {
			return nil, err
		}
		subs = append(subs, sub)
	}
	return subs, rows.Err()
}
