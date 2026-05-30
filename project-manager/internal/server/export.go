package server

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"project-manager/internal/db"

	"github.com/go-chi/chi/v5"
)

func exportProject(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}

	export := db.ExportData{
		AppVersion:    db.AppVersion,
		SchemaVersion: db.CurrentSchemaVersion,
		ExportedAt:    db.Now(),
		Data:          collectProjectData(id),
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="project-%d-export.json"`, id))
	json.NewEncoder(w).Encode(export)
}

func exportAll(w http.ResponseWriter, r *http.Request) {
	export := db.ExportData{
		AppVersion:    db.AppVersion,
		SchemaVersion: db.CurrentSchemaVersion,
		ExportedAt:    db.Now(),
		Data:          collectAllData(),
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Content-Disposition", "attachment; filename=\"project-manager-backup.json\"")
	json.NewEncoder(w).Encode(export)
}

func importData(w http.ResponseWriter, r *http.Request) {
	var export db.ExportData
	if err := json.NewDecoder(r.Body).Decode(&export); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON format")
		return
	}

	// Version check
	if export.SchemaVersion > db.CurrentSchemaVersion {
		writeError(w, http.StatusBadRequest,
			fmt.Sprintf("data schema version (%d) is newer than app schema version (%d). Please upgrade the application.",
				export.SchemaVersion, db.CurrentSchemaVersion))
		return
	}

	// Import based on schema version
	var err error
	switch export.SchemaVersion {
	case 0, 1:
		err = importV1(export.Data)
	default:
		err = importV1(export.Data)
	}

	if err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("import failed: %v", err))
		return
	}

	counts := map[string]int{
		"projects":       len(export.Data.Projects),
		"task_groups":    len(export.Data.TaskGroups),
		"tasks":          len(export.Data.Tasks),
		"issues":         len(export.Data.Issues),
		"notes":          len(export.Data.Notes),
		"calendar_events": len(export.Data.CalendarEvents),
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"message":  "import successful",
		"imported": counts,
	})
}

func importV1(data db.ExportPayload) error {
	tx, err := db.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Projects
	oldToNewProjectIDs := make(map[int64]int64)
	for _, p := range data.Projects {
		result, err := tx.Exec(
			`INSERT INTO projects (name, description, phase, metadata, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
			p.Name, p.Description, p.Phase, p.Metadata, p.CreatedAt, p.UpdatedAt,
		)
		if err != nil {
			return fmt.Errorf("import project %q: %w", p.Name, err)
		}
		newID, _ := result.LastInsertId()
		oldToNewProjectIDs[p.ID] = newID
	}

	// Task Groups
	oldToNewGroupIDs := make(map[int64]int64)
	for _, g := range data.TaskGroups {
		newProjectID, ok := oldToNewProjectIDs[g.ProjectID]
		if !ok {
			continue
		}
		result, err := tx.Exec(
			`INSERT INTO task_groups (project_id, name, sort_order, metadata, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
			newProjectID, g.Name, g.SortOrder, g.Metadata, g.CreatedAt, g.UpdatedAt,
		)
		if err != nil {
			return fmt.Errorf("import task group %q: %w", g.Name, err)
		}
		newID, _ := result.LastInsertId()
		oldToNewGroupIDs[g.ID] = newID
	}

	// Tasks
	oldToNewTaskIDs := make(map[int64]int64)
	for _, t := range data.Tasks {
		newProjectID, ok := oldToNewProjectIDs[t.ProjectID]
		if !ok {
			continue
		}
		var newGroupID *int64
		if t.GroupID != nil {
			if ngid, ok := oldToNewGroupIDs[*t.GroupID]; ok {
				newGroupID = &ngid
			}
		}
		result, err := tx.Exec(
			`INSERT INTO tasks (project_id, group_id, title, description, assignee, status, priority,
			 planned_start_date, planned_end_date, actual_start_date, actual_end_date,
			 sort_order, metadata, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			newProjectID, newGroupID, t.Title, t.Description, t.Assignee, t.Status, t.Priority,
			t.PlannedStartDate, t.PlannedEndDate, t.ActualStartDate, t.ActualEndDate,
			t.SortOrder, t.Metadata, t.CreatedAt, t.UpdatedAt,
		)
		if err != nil {
			return fmt.Errorf("import task %q: %w", t.Title, err)
		}
		newID, _ := result.LastInsertId()
		oldToNewTaskIDs[t.ID] = newID
	}

	// Issues
	for _, i := range data.Issues {
		newProjectID, ok := oldToNewProjectIDs[i.ProjectID]
		if !ok {
			continue
		}
		_, err := tx.Exec(
			`INSERT INTO issues (project_id, title, description, assignee, status, priority, due_date, metadata, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			newProjectID, i.Title, i.Description, i.Assignee, i.Status, i.Priority, i.DueDate, i.Metadata, i.CreatedAt, i.UpdatedAt,
		)
		if err != nil {
			return fmt.Errorf("import issue %q: %w", i.Title, err)
		}
	}

	// Notes
	for _, n := range data.Notes {
		newProjectID, ok := oldToNewProjectIDs[n.ProjectID]
		if !ok {
			continue
		}
		_, err := tx.Exec(
			`INSERT INTO notes (project_id, title, content, is_pinned, metadata, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`,
			newProjectID, n.Title, n.Content, n.IsPinned, n.Metadata, n.CreatedAt, n.UpdatedAt,
		)
		if err != nil {
			return fmt.Errorf("import note %q: %w", n.Title, err)
		}
	}

	// Calendar Events
	for _, ce := range data.CalendarEvents {
		newProjectID, ok := oldToNewProjectIDs[ce.ProjectID]
		if !ok {
			continue
		}
		var newTaskID *int64
		if ce.TaskID != nil {
			if ntid, ok := oldToNewTaskIDs[*ce.TaskID]; ok {
				newTaskID = &ntid
			}
		}
		_, err := tx.Exec(
			`INSERT INTO calendar_events (project_id, task_id, date, completion_status, notes, metadata, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			newProjectID, newTaskID, ce.Date, ce.CompletionStatus, ce.Notes, ce.Metadata, ce.CreatedAt, ce.UpdatedAt,
		)
		if err != nil {
			return fmt.Errorf("import calendar event date %q: %w", ce.Date, err)
		}
	}

	return tx.Commit()
}

func collectProjectData(projectID int64) db.ExportPayload {
	var data db.ExportPayload

	// Project
	var p db.Project
	err := db.DB.QueryRow(`SELECT id, name, description, phase, metadata, created_at, updated_at FROM projects WHERE id=?`, projectID).Scan(&p.ID, &p.Name, &p.Description, &p.Phase, &p.Metadata, &p.CreatedAt, &p.UpdatedAt)
	if err == nil {
		data.Projects = []db.Project{p}
	}

	data.TaskGroups = collectRows[db.TaskGroup](`SELECT id, project_id, name, sort_order, metadata, created_at, updated_at FROM task_groups WHERE project_id=?`, projectID, scanGroup)
	data.Tasks = collectRows[db.Task](`SELECT `+taskColumns+` FROM tasks WHERE project_id=?`, projectID, scanTask)
	data.Issues = collectRows[db.Issue](`SELECT `+issueColumns+` FROM issues WHERE project_id=?`, projectID, scanIssue)
	data.Notes = collectRows[db.Note](`SELECT `+noteColumns+` FROM notes WHERE project_id=?`, projectID, scanNote)
	data.CalendarEvents = collectRows[db.CalendarEvent](`SELECT id, project_id, task_id, date, completion_status, notes, metadata, created_at, updated_at FROM calendar_events WHERE project_id=?`, projectID, scanCalendarEvent)

	return data
}

func collectAllData() db.ExportPayload {
	var data db.ExportPayload
	data.Projects = collectAllRows[db.Project](`SELECT id, name, description, phase, metadata, created_at, updated_at FROM projects`, scanProject)
	data.TaskGroups = collectAllRows[db.TaskGroup](`SELECT id, project_id, name, sort_order, metadata, created_at, updated_at FROM task_groups`, scanGroup)
	data.Tasks = collectAllRows[db.Task](`SELECT `+taskColumns+` FROM tasks`, scanTask)
	data.Issues = collectAllRows[db.Issue](`SELECT `+issueColumns+` FROM issues`, scanIssue)
	data.Notes = collectAllRows[db.Note](`SELECT `+noteColumns+` FROM notes`, scanNote)
	data.CalendarEvents = collectAllRows[db.CalendarEvent](`SELECT id, project_id, task_id, date, completion_status, notes, metadata, created_at, updated_at FROM calendar_events`, scanCalendarEvent)
	return data
}

// Generic row collectors with scanning functions

type RowScanner interface {
	Scan(...interface{}) error
}

func scanProject(rows RowScanner) (db.Project, error) {
	var p db.Project
	err := rows.Scan(&p.ID, &p.Name, &p.Description, &p.Phase, &p.Metadata, &p.CreatedAt, &p.UpdatedAt)
	return p, err
}

func scanGroup(rows RowScanner) (db.TaskGroup, error) {
	var g db.TaskGroup
	err := rows.Scan(&g.ID, &g.ProjectID, &g.Name, &g.SortOrder, &g.Metadata, &g.CreatedAt, &g.UpdatedAt)
	return g, err
}

func scanIssue(rows RowScanner) (db.Issue, error) {
	var i db.Issue
	err := rows.Scan(&i.ID, &i.ProjectID, &i.Title, &i.Description, &i.Assignee, &i.Status, &i.Priority, &i.DueDate, &i.Metadata, &i.CreatedAt, &i.UpdatedAt)
	return i, err
}

func scanNote(rows RowScanner) (db.Note, error) {
	var n db.Note
	err := rows.Scan(&n.ID, &n.ProjectID, &n.Title, &n.Content, &n.IsPinned, &n.Metadata, &n.CreatedAt, &n.UpdatedAt)
	return n, err
}

func scanCalendarEvent(rows RowScanner) (db.CalendarEvent, error) {
	var ce db.CalendarEvent
	err := rows.Scan(&ce.ID, &ce.ProjectID, &ce.TaskID, &ce.Date, &ce.CompletionStatus, &ce.Notes, &ce.Metadata, &ce.CreatedAt, &ce.UpdatedAt)
	return ce, err
}

func collectRows[T any](query string, projectID int64, scanFn func(RowScanner) (T, error)) []T {
	rows, err := db.DB.Query(query, projectID)
	if err != nil {
		return make([]T, 0)
	}
	defer rows.Close()

	result := make([]T, 0)
	for rows.Next() {
		item, err := scanFn(rows)
		if err == nil {
			result = append(result, item)
		}
	}
	return result
}

func collectAllRows[T any](query string, scanFn func(RowScanner) (T, error)) []T {
	rows, err := db.DB.Query(query)
	if err != nil {
		return make([]T, 0)
	}
	defer rows.Close()

	result := make([]T, 0)
	for rows.Next() {
		item, err := scanFn(rows)
		if err == nil {
			result = append(result, item)
		}
	}
	return result
}
