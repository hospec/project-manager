package db

import (
	"embed"
	"fmt"
	"sort"
	"strconv"
	"strings"
)

//go:embed migrations/*.sql
var migrationsFS embed.FS

// RunMigrations executes any pending SQL migrations in order
func RunMigrations() error {
	_, err := DB.Exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
		version INTEGER PRIMARY KEY,
		applied_at TEXT NOT NULL DEFAULT (datetime('now'))
	)`)
	if err != nil {
		return fmt.Errorf("create schema_migrations: %w", err)
	}

	entries, err := migrationsFS.ReadDir("migrations")
	if err != nil {
		return fmt.Errorf("read migrations dir: %w", err)
	}

	type migration struct {
		version  int
		filename string
		sql      string
	}
	var migrations []migration

	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".sql") {
			continue
		}
		version, err := strconv.Atoi(strings.SplitN(entry.Name(), "_", 2)[0])
		if err != nil {
			return fmt.Errorf("parse migration version from %s: %w", entry.Name(), err)
		}
		sqlBytes, err := migrationsFS.ReadFile("migrations/" + entry.Name())
		if err != nil {
			return fmt.Errorf("read migration %s: %w", entry.Name(), err)
		}
		migrations = append(migrations, migration{version: version, filename: entry.Name(), sql: string(sqlBytes)})
	}

	sort.Slice(migrations, func(i, j int) bool {
		return migrations[i].version < migrations[j].version
	})

	for _, m := range migrations {
		var exists bool
		err := DB.QueryRow("SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version=?)", m.version).Scan(&exists)
		if err != nil {
			return fmt.Errorf("check migration %d: %w", m.version, err)
		}
		if exists {
			continue
		}

		_, err = DB.Exec(m.sql)
		if err != nil {
			return fmt.Errorf("apply migration %d: %w", m.version, err)
		}

		_, err = DB.Exec("INSERT INTO schema_migrations (version) VALUES (?)", m.version)
		if err != nil {
			return fmt.Errorf("record migration %d: %w", m.version, err)
		}
		fmt.Printf("Applied migration %d: %s\n", m.version, m.filename)
	}

	return nil
}
