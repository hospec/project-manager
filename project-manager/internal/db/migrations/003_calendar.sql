-- Safe add progress column (for DBs created before 001 was updated)
-- Use a transaction; if column already exists the migration will fail,
-- so we handle this gracefully in GO migration code instead.
-- We add risk unconditionally and create the daily notes table.

ALTER TABLE tasks ADD COLUMN risk TEXT DEFAULT '';

CREATE TABLE IF NOT EXISTS task_daily_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    content TEXT DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(task_id, date)
);

CREATE INDEX IF NOT EXISTS idx_task_daily_notes_task_date ON task_daily_notes(task_id, date);
