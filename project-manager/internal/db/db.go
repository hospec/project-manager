package db

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"

	_ "modernc.org/sqlite"
)

var DB *sql.DB

// Open opens (or creates) the SQLite database and runs migrations
func Open(dbPath string) error {
	if dbPath == "" {
		execPath, err := os.Executable()
		if err != nil {
			execPath = "."
		}
		dbPath = filepath.Join(filepath.Dir(execPath), "project-data.db")
	}

	var err error
	DB, err = sql.Open("sqlite", dbPath+"?_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)&_pragma=foreign_keys(ON)")
	if err != nil {
		return fmt.Errorf("open database: %w", err)
	}

	DB.SetMaxOpenConns(1)

	if err := RunMigrations(); err != nil {
		return fmt.Errorf("run migrations: %w", err)
	}

	return nil
}

// Close closes the database connection
func Close() {
	if DB != nil {
		DB.Close()
	}
}
