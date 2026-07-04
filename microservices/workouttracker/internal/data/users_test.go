package data

import (
	"database/sql/driver"
	"errors"
	"testing"
	"time"
)

func TestUserModelUpdatePersistsNewHashAndBumpsVersion(t *testing.T) {
	hash := []byte("new-bcrypt-hash")

	db, stub := newStubDB(t,
		stubExpectation{
			op:          "query",
			sqlContains: "UPDATE users SET name = $1, email = $2, password_hash = $3, activated = $4, role = $5, version = version + 1",
			args:        []driver.Value{"Ana", "ana@example.com", hash, true, "user", int64(3), int64(2)},
			rows: &stubRows{
				columns: []string{"version"},
				values:  [][]driver.Value{{int64(3)}},
			},
		},
	)

	model := UserModel{DB: db}
	user := &User{
		ID:        3,
		Name:      "Ana",
		Email:     "ana@example.com",
		Activated: true,
		Role:      "user",
		Version:   2,
	}
	user.Password.Hash = hash

	if err := model.Update(user); err != nil {
		t.Fatalf("Update: %v", err)
	}
	if user.Version != 3 {
		t.Errorf("version = %d, want 3", user.Version)
	}

	stub.assertExhausted(t)
}

func TestUserModelUpdateReturnsEditConflict(t *testing.T) {
	db, stub := newStubDB(t,
		stubExpectation{
			op:          "query",
			sqlContains: "UPDATE users",
			rows:        &stubRows{columns: []string{"version"}},
		},
	)

	model := UserModel{DB: db}
	user := &User{ID: 3, Name: "Ana", Email: "ana@example.com", Role: "user", Version: 2}
	user.Password.Hash = []byte("h")

	err := model.Update(user)
	if !errors.Is(err, ErrEditConflict) {
		t.Fatalf("err = %v, want ErrEditConflict", err)
	}

	stub.assertExhausted(t)
}

func TestUserModelGetForTokenReturnsMatchingUser(t *testing.T) {
	now := time.Now()

	db, stub := newStubDB(t,
		stubExpectation{
			op:          "query",
			sqlContains: "INNER JOIN tokens ON users.id = tokens.user_id WHERE tokens.hash = $1 AND tokens.scope = $2 AND tokens.expiry > $3",
			rows: &stubRows{
				columns: []string{"id", "created_at", "name", "email", "password_hash", "activated", "role", "version"},
				values: [][]driver.Value{
					{int64(7), now, "Ana", "ana@example.com", []byte("h"), true, "user", int64(1)},
				},
			},
		},
	)

	model := UserModel{DB: db}

	user, err := model.GetForToken(ScopePasswordReset, "ABCDEFGHIJKLMNOPQRSTUVWXYZ")
	if err != nil {
		t.Fatalf("GetForToken: %v", err)
	}
	if user.ID != 7 || user.Email != "ana@example.com" {
		t.Errorf("unexpected user %+v", user)
	}

	stub.assertExhausted(t)
}

func TestUserModelGetForTokenReturnsNotFound(t *testing.T) {
	db, stub := newStubDB(t,
		stubExpectation{
			op:          "query",
			sqlContains: "INNER JOIN tokens",
			rows:        &stubRows{columns: []string{"id"}},
		},
	)

	model := UserModel{DB: db}

	_, err := model.GetForToken(ScopePasswordReset, "ABCDEFGHIJKLMNOPQRSTUVWXYZ")
	if !errors.Is(err, ErrRecordNotFound) {
		t.Fatalf("err = %v, want ErrRecordNotFound", err)
	}

	stub.assertExhausted(t)
}

func TestUserModelListAllOmitsPasswordHash(t *testing.T) {
	now := time.Now()

	db, stub := newStubDB(t,
		stubExpectation{
			op:          "query",
			sqlContains: "SELECT id, created_at, name, email, activated, role, version FROM users ORDER BY id",
			rows: &stubRows{
				columns: []string{"id", "created_at", "name", "email", "activated", "role", "version"},
				values: [][]driver.Value{
					{int64(1), now, "Ana", "ana@example.com", true, "admin", int64(1)},
					{int64(2), now, "Bo", "bo@example.com", true, "user", int64(4)},
				},
			},
		},
	)

	model := UserModel{DB: db}

	users, err := model.ListAll()
	if err != nil {
		t.Fatalf("ListAll: %v", err)
	}
	if len(users) != 2 {
		t.Fatalf("len = %d, want 2", len(users))
	}
	if users[0].Role != "admin" || users[1].ID != 2 {
		t.Errorf("unexpected users %+v", users)
	}
	if users[0].Password.Hash != nil {
		t.Error("password hash must not be loaded by ListAll")
	}

	stub.assertExhausted(t)
}
