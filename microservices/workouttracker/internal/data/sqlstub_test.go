package data

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"fmt"
	"io"
	"reflect"
	"strings"
	"sync"
	"testing"
)

type stubExpectation struct {
	op          string
	sqlContains string
	args        []driver.Value
	rows        *stubRows
	result      driver.Result
	err         error
}

type stubRows struct {
	columns []string
	values  [][]driver.Value
	index   int
}

func (r *stubRows) Columns() []string {
	return r.columns
}

func (r *stubRows) Close() error {
	return nil
}

func (r *stubRows) Next(dest []driver.Value) error {
	if r.index >= len(r.values) {
		return io.EOF
	}

	for i, value := range r.values[r.index] {
		dest[i] = value
	}
	r.index++
	return nil
}

type stubDB struct {
	mu           sync.Mutex
	expectations []stubExpectation
}

func (db *stubDB) pop(op, query string, args []driver.NamedValue) (stubExpectation, error) {
	db.mu.Lock()
	defer db.mu.Unlock()

	if len(db.expectations) == 0 {
		return stubExpectation{}, fmt.Errorf("unexpected %s with query %q", op, normalizeSQL(query))
	}

	exp := db.expectations[0]
	db.expectations = db.expectations[1:]

	if exp.op != op {
		return stubExpectation{}, fmt.Errorf("unexpected operation %q, want %q", op, exp.op)
	}

	if exp.sqlContains != "" && !strings.Contains(normalizeSQL(query), normalizeSQL(exp.sqlContains)) {
		return stubExpectation{}, fmt.Errorf("unexpected query %q, want it to contain %q", normalizeSQL(query), normalizeSQL(exp.sqlContains))
	}

	if exp.args != nil {
		if len(exp.args) != len(args) {
			return stubExpectation{}, fmt.Errorf("unexpected arg count %d, want %d", len(args), len(exp.args))
		}

		for i, expected := range exp.args {
			if !valuesEqual(expected, args[i].Value) {
				return stubExpectation{}, fmt.Errorf("unexpected arg %d value %#v, want %#v", i, args[i].Value, expected)
			}
		}
	}

	return exp, nil
}

func (db *stubDB) assertExhausted(t *testing.T) {
	t.Helper()

	db.mu.Lock()
	defer db.mu.Unlock()

	if len(db.expectations) != 0 {
		t.Fatalf("unmet expectations: %+v", db.expectations)
	}
}

type stubDriver struct{}

func (stubDriver) Open(name string) (driver.Conn, error) {
	stubRegistryMu.Lock()
	db := stubRegistry[name]
	stubRegistryMu.Unlock()

	if db == nil {
		return nil, fmt.Errorf("unknown stub db %q", name)
	}

	return &stubConn{db: db}, nil
}

type stubConn struct {
	db *stubDB
}

func (c *stubConn) Prepare(string) (driver.Stmt, error) {
	return nil, fmt.Errorf("Prepare is not supported by the stub driver")
}

func (c *stubConn) Close() error {
	return nil
}

func (c *stubConn) Begin() (driver.Tx, error) {
	return c.BeginTx(context.Background(), driver.TxOptions{})
}

func (c *stubConn) BeginTx(_ context.Context, _ driver.TxOptions) (driver.Tx, error) {
	exp, err := c.db.pop("begin", "", nil)
	if err != nil {
		return nil, err
	}
	if exp.err != nil {
		return nil, exp.err
	}
	return &stubTx{db: c.db}, nil
}

func (c *stubConn) QueryContext(_ context.Context, query string, args []driver.NamedValue) (driver.Rows, error) {
	exp, err := c.db.pop("query", query, args)
	if err != nil {
		return nil, err
	}
	if exp.err != nil {
		return nil, exp.err
	}
	if exp.rows == nil {
		return &stubRows{}, nil
	}
	return &stubRows{columns: exp.rows.columns, values: exp.rows.values}, nil
}

func (c *stubConn) ExecContext(_ context.Context, query string, args []driver.NamedValue) (driver.Result, error) {
	exp, err := c.db.pop("exec", query, args)
	if err != nil {
		return nil, err
	}
	if exp.err != nil {
		return nil, exp.err
	}
	if exp.result == nil {
		return driver.RowsAffected(0), nil
	}
	return exp.result, nil
}

type stubTx struct {
	db *stubDB
}

func (tx *stubTx) Commit() error {
	exp, err := tx.db.pop("commit", "", nil)
	if err != nil {
		return err
	}
	return exp.err
}

func (tx *stubTx) Rollback() error {
	return nil
}

var (
	registerStubDriver sync.Once
	stubRegistryMu     sync.Mutex
	stubRegistry       = map[string]*stubDB{}
	stubSequence       int
)

func newStubDB(t *testing.T, expectations ...stubExpectation) (*sql.DB, *stubDB) {
	t.Helper()

	registerStubDriver.Do(func() {
		sql.Register("data-test-stub", stubDriver{})
	})

	stubRegistryMu.Lock()
	stubSequence++
	dsn := fmt.Sprintf("stub-%d", stubSequence)
	dbState := &stubDB{expectations: append([]stubExpectation(nil), expectations...)}
	stubRegistry[dsn] = dbState
	stubRegistryMu.Unlock()

	sqlDB, err := sql.Open("data-test-stub", dsn)
	if err != nil {
		t.Fatalf("open stub db: %v", err)
	}
	sqlDB.SetMaxOpenConns(1)

	t.Cleanup(func() {
		_ = sqlDB.Close()

		stubRegistryMu.Lock()
		delete(stubRegistry, dsn)
		stubRegistryMu.Unlock()
	})

	return sqlDB, dbState
}

func normalizeSQL(query string) string {
	return strings.Join(strings.Fields(query), " ")
}

func valuesEqual(expected, actual driver.Value) bool {
	if reflect.DeepEqual(expected, actual) {
		return true
	}

	if want, ok := asInt64(expected); ok {
		if got, ok := asInt64(actual); ok {
			return want == got
		}
	}

	if want, ok := asFloat64(expected); ok {
		if got, ok := asFloat64(actual); ok {
			return want == got
		}
	}

	return false
}

func asInt64(v driver.Value) (int64, bool) {
	switch n := v.(type) {
	case int:
		return int64(n), true
	case int8:
		return int64(n), true
	case int16:
		return int64(n), true
	case int32:
		return int64(n), true
	case int64:
		return n, true
	case uint:
		return int64(n), true
	case uint8:
		return int64(n), true
	case uint16:
		return int64(n), true
	case uint32:
		return int64(n), true
	case uint64:
		return int64(n), true
	default:
		return 0, false
	}
}

func asFloat64(v driver.Value) (float64, bool) {
	switch n := v.(type) {
	case float32:
		return float64(n), true
	case float64:
		return n, true
	default:
		return 0, false
	}
}
