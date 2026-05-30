package server

import (
	"encoding/json"
	"net/http"
	"strconv"

	"project-manager/internal/db"

	"github.com/go-chi/chi/v5"
)

func listProjects(w http.ResponseWriter, r *http.Request) {
	rows, err := db.DB.Query(`SELECT id, name, description, phase, metadata, created_at, updated_at FROM projects ORDER BY updated_at DESC`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()

	projects := []db.Project{}
	for rows.Next() {
		var p db.Project
		if err := rows.Scan(&p.ID, &p.Name, &p.Description, &p.Phase, &p.Metadata, &p.CreatedAt, &p.UpdatedAt); err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		projects = append(projects, p)
	}
	writeJSON(w, http.StatusOK, projects)
}

func createProject(w http.ResponseWriter, r *http.Request) {
	var p db.Project
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	if p.Name == "" {
		writeError(w, http.StatusBadRequest, "name is required")
		return
	}
	if p.Phase == "" {
		p.Phase = "planning"
	}
	if p.Metadata == "" {
		p.Metadata = "{}"
	}

	now := db.Now()
	result, err := db.DB.Exec(
		`INSERT INTO projects (name, description, phase, metadata, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
		p.Name, p.Description, p.Phase, p.Metadata, now, now,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	id, _ := result.LastInsertId()
	p.ID = id
	p.CreatedAt = now
	p.UpdatedAt = now
	writeJSON(w, http.StatusCreated, p)
}

func getProject(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}

	var p db.Project
	err = db.DB.QueryRow(
		`SELECT id, name, description, phase, metadata, created_at, updated_at FROM projects WHERE id=?`, id,
	).Scan(&p.ID, &p.Name, &p.Description, &p.Phase, &p.Metadata, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		writeError(w, http.StatusNotFound, "project not found")
		return
	}
	writeJSON(w, http.StatusOK, p)
}

func updateProject(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}

	var input db.Project
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON")
		return
	}

	now := db.Now()
	result, err := db.DB.Exec(
		`UPDATE projects SET name=?, description=?, phase=?, metadata=?, updated_at=? WHERE id=?`,
		input.Name, input.Description, input.Phase, input.Metadata, now, id,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if n, _ := result.RowsAffected(); n == 0 {
		writeError(w, http.StatusNotFound, "project not found")
		return
	}

	input.ID = id
	input.UpdatedAt = now
	writeJSON(w, http.StatusOK, input)
}

func deleteProject(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}

	result, err := db.DB.Exec(`DELETE FROM projects WHERE id=?`, id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if n, _ := result.RowsAffected(); n == 0 {
		writeError(w, http.StatusNotFound, "project not found")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func getProjectOverview(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}

	// Fetch project
	var p db.Project
	err = db.DB.QueryRow(
		`SELECT id, name, description, phase, metadata, created_at, updated_at FROM projects WHERE id=?`, id,
	).Scan(&p.ID, &p.Name, &p.Description, &p.Phase, &p.Metadata, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		writeError(w, http.StatusNotFound, "project not found")
		return
	}

	overview := db.ProjectOverview{
		Project:           p,
		Risks:             []db.Task{},
		UpcomingDeadlines: []db.DeadlineItem{},
	}

	// Task completion stats
	db.DB.QueryRow(`SELECT COUNT(*) FROM tasks WHERE project_id=?`, id).Scan(&overview.TaskCompletion.Total)
	db.DB.QueryRow(`SELECT COUNT(*) FROM tasks WHERE project_id=? AND status='done'`, id).Scan(&overview.TaskCompletion.Done)
	db.DB.QueryRow(`SELECT COUNT(*) FROM tasks WHERE project_id=? AND status='in_progress'`, id).Scan(&overview.TaskCompletion.InProgress)
	db.DB.QueryRow(`SELECT COUNT(*) FROM tasks WHERE project_id=? AND status='todo'`, id).Scan(&overview.TaskCompletion.Todo)
	db.DB.QueryRow(`SELECT COUNT(*) FROM tasks WHERE project_id=? AND status='blocked'`, id).Scan(&overview.TaskCompletion.Blocked)
	if overview.TaskCompletion.Total > 0 {
		overview.TaskCompletion.Percentage = float64(overview.TaskCompletion.Done) / float64(overview.TaskCompletion.Total) * 100
	}

	// Risks: blocked tasks
	riskRows, err := db.DB.Query(
		`SELECT id, project_id, group_id, title, description, assignee, status, priority,
		 planned_start_date, planned_end_date, actual_start_date, actual_end_date, sort_order, metadata, created_at, updated_at
		 FROM tasks WHERE project_id=? AND status='blocked' ORDER BY updated_at DESC LIMIT 10`, id,
	)
	if err == nil {
		for riskRows.Next() {
			var t db.Task
			riskRows.Scan(&t.ID, &t.ProjectID, &t.GroupID, &t.Title, &t.Description, &t.Assignee,
				&t.Status, &t.Priority, &t.PlannedStartDate, &t.PlannedEndDate,
				&t.ActualStartDate, &t.ActualEndDate, &t.SortOrder, &t.Metadata, &t.CreatedAt, &t.UpdatedAt)
			overview.Risks = append(overview.Risks, t)
		}
		riskRows.Close()
	}

	// Upcoming deadlines: tasks due within 7 days
	deadlineRows, err := db.DB.Query(
		`SELECT id, title, assignee, planned_end_date,
		 CAST(julianday(planned_end_date) - julianday('now') AS INTEGER) as days_until
		 FROM tasks WHERE project_id=? AND status != 'done' AND planned_end_date != ''
		 AND planned_end_date >= date('now') AND planned_end_date <= date('now', '+7 days')
		 ORDER BY planned_end_date ASC LIMIT 10`, id,
	)
	if err == nil {
		for deadlineRows.Next() {
			var d db.DeadlineItem
			deadlineRows.Scan(&d.ID, &d.Title, &d.Assignee, &d.PlannedEndDate, &d.DaysUntil)
			overview.UpcomingDeadlines = append(overview.UpcomingDeadlines, d)
		}
		deadlineRows.Close()
	}

	// Recent completions (last 7 days)
	db.DB.QueryRow(
		`SELECT COUNT(*) FROM calendar_events WHERE project_id=? AND date >= date('now', '-7 days') AND completion_status='full'`, id,
	).Scan(&overview.RecentCompletions)

	// Open issue count
	db.DB.QueryRow(`SELECT COUNT(*) FROM issues WHERE project_id=? AND status IN ('open','in_progress')`, id).Scan(&overview.OpenIssueCount)

	writeJSON(w, http.StatusOK, overview)
}

// Helper functions

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}
