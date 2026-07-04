package main

import (
	"context"
	"database/sql"
	"flag"
	"log/slog"
	"os"
	"strings"
	"time"

	"github.com/lib/pq"
	"workouttracker.jcroyoaun.io/internal/data"
	"workouttracker.jcroyoaun.io/migrations"
)

const version = "1.0.0"

type config struct {
	port int
	env  string
	db   struct {
		dsn          string
		maxOpenConns int
		maxIdleConns int
		maxIdleTime  time.Duration
	}
	jwt struct {
		secret string
	}
	// inviteCode gates new-user registration. When empty (e.g. local
	// development), registration is open; when set, /v1/users/register
	// requires a matching invite_code in the request body.
	inviteCode string
	// adminEmails lists accounts holding the admin role (exercise-catalog
	// writes). Promotion runs at startup and on registration; there is no
	// in-app path to admin.
	adminEmails []string
	// vapid holds the web-push keypair for rest-timer notifications. When
	// either key is empty, push endpoints report the feature unconfigured
	// and the webapp hides the toggle.
	vapid struct {
		publicKey  string
		privateKey string
	}
}

type application struct {
	config     config
	logger     *slog.Logger
	models     data.Models
	restAlarms *restAlarmScheduler
}

func main() {
	var cfg config

	flag.IntVar(&cfg.port, "port", 4001, "API server port")
	flag.StringVar(&cfg.env, "env", "development", "Environment (development|staging|production)")
	flag.StringVar(&cfg.db.dsn, "db-dsn", os.Getenv("WORKOUTTRACKER_DB_DSN"), "PostgreSQL DSN")
	flag.IntVar(&cfg.db.maxOpenConns, "db-max-open-conns", 25, "PostgreSQL max open connections")
	flag.IntVar(&cfg.db.maxIdleConns, "db-max-idle-conns", 25, "PostgreSQL max idle connections")
	flag.DurationVar(&cfg.db.maxIdleTime, "db-max-idle-time", 15*time.Minute, "PostgreSQL max connection idle time")
	flag.StringVar(&cfg.jwt.secret, "jwt-secret", os.Getenv("JWT_SECRET"), "JWT signing secret")
	flag.StringVar(&cfg.inviteCode, "invite-code", os.Getenv("INVITE_CODE"), "Invite code required for registration (empty = open registration)")
	flag.StringVar(&cfg.vapid.publicKey, "vapid-public-key", os.Getenv("VAPID_PUBLIC_KEY"), "VAPID public key for web push (empty = push disabled)")
	flag.StringVar(&cfg.vapid.privateKey, "vapid-private-key", os.Getenv("VAPID_PRIVATE_KEY"), "VAPID private key for web push (empty = push disabled)")
	adminEmailsRaw := flag.String("admin-emails", os.Getenv("ADMIN_EMAILS"), "Comma-separated emails promoted to the admin role at startup")

	migrateOnly := flag.Bool("migrate-only", false, "Run database migrations and exit")

	flag.Parse()

	for _, e := range strings.Split(*adminEmailsRaw, ",") {
		if e = strings.TrimSpace(e); e != "" {
			cfg.adminEmails = append(cfg.adminEmails, e)
		}
	}

	logger := slog.New(slog.NewTextHandler(os.Stdout, nil))

	db, err := openDB(cfg)
	if err != nil {
		logger.Error(err.Error())
		os.Exit(1)
	}
	defer db.Close()

	logger.Info("database connection pool established")

	err = migrations.Up(db)
	if err != nil {
		logger.Error("database migration failed", "error", err.Error())
		os.Exit(1)
	}
	logger.Info("database migrations applied")

	// Promote configured admin accounts (existing users; new ones get the
	// role at registration). Promotion only — never demotes.
	if len(cfg.adminEmails) > 0 {
		res, err := db.Exec(
			`UPDATE users SET role = 'admin' WHERE lower(email) = ANY($1) AND role <> 'admin'`,
			pq.Array(lowerAll(cfg.adminEmails)),
		)
		if err != nil {
			logger.Error("admin promotion failed", "error", err.Error())
			os.Exit(1)
		}
		if n, _ := res.RowsAffected(); n > 0 {
			logger.Info("promoted admin users", "count", n)
		}
	}

	if *migrateOnly {
		return
	}

	app := &application{
		config:     cfg,
		logger:     logger,
		models:     data.NewModels(db),
		restAlarms: newRestAlarmScheduler(),
	}

	err = app.serve()
	if err != nil {
		logger.Error(err.Error())
		os.Exit(1)
	}
}

func lowerAll(ss []string) []string {
	out := make([]string, len(ss))
	for i, s := range ss {
		out[i] = strings.ToLower(s)
	}
	return out
}

func openDB(cfg config) (*sql.DB, error) {
	db, err := sql.Open("postgres", cfg.db.dsn)
	if err != nil {
		return nil, err
	}

	db.SetMaxOpenConns(cfg.db.maxOpenConns)
	db.SetMaxIdleConns(cfg.db.maxIdleConns)
	db.SetConnMaxIdleTime(cfg.db.maxIdleTime)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	err = db.PingContext(ctx)
	if err != nil {
		db.Close()
		return nil, err
	}

	return db, nil
}

