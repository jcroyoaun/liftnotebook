package data

import (
	"database/sql/driver"
	"testing"
)

func TestPushSubscriptionUpsertClaimsEndpoint(t *testing.T) {
	db, stub := newStubDB(t,
		stubExpectation{
			op:          "query",
			sqlContains: "INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES ($1, $2, $3, $4) ON CONFLICT (endpoint) DO UPDATE",
			args:        []driver.Value{int64(7), "https://push.example/ep1", "p256", "auth"},
			rows: &stubRows{
				columns: []string{"id"},
				values:  [][]driver.Value{{int64(3)}},
			},
		},
	)

	model := PushSubscriptionModel{DB: db}
	sub := &PushSubscription{UserID: 7, Endpoint: "https://push.example/ep1", P256dh: "p256", Auth: "auth"}

	if err := model.Upsert(sub); err != nil {
		t.Fatalf("Upsert: %v", err)
	}
	if sub.ID != 3 {
		t.Errorf("id = %d, want 3", sub.ID)
	}

	stub.assertExhausted(t)
}

func TestPushSubscriptionGetForUser(t *testing.T) {
	db, stub := newStubDB(t,
		stubExpectation{
			op:          "query",
			sqlContains: "FROM push_subscriptions WHERE user_id = $1",
			args:        []driver.Value{int64(7)},
			rows: &stubRows{
				columns: []string{"id", "user_id", "endpoint", "p256dh", "auth"},
				values: [][]driver.Value{
					{int64(1), int64(7), "https://push.example/a", "pa", "aa"},
					{int64(2), int64(7), "https://push.example/b", "pb", "ab"},
				},
			},
		},
	)

	model := PushSubscriptionModel{DB: db}

	subs, err := model.GetForUser(7)
	if err != nil {
		t.Fatalf("GetForUser: %v", err)
	}
	if len(subs) != 2 || subs[1].Endpoint != "https://push.example/b" {
		t.Errorf("unexpected subs %+v", subs)
	}

	stub.assertExhausted(t)
}

func TestPushSubscriptionDeleteScopedToUser(t *testing.T) {
	db, stub := newStubDB(t,
		stubExpectation{
			op:          "exec",
			sqlContains: "DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2",
			args:        []driver.Value{int64(7), "https://push.example/a"},
			result:      driver.RowsAffected(1),
		},
	)

	model := PushSubscriptionModel{DB: db}

	if err := model.Delete(7, "https://push.example/a"); err != nil {
		t.Fatalf("Delete: %v", err)
	}

	stub.assertExhausted(t)
}
