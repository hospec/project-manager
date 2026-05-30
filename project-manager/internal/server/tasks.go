package server

import (
	"encoding/json"
	"net/http"
	"strconv"

	"project-manager/internal/db"

	"github.com/go-chi/chi/v5"
)

func scanTask(scanner RowScanner) (db.Task, error) {
	var t db.Task
	err := scanner.Scan(&t.ID, &t.ProjectID, &t.GroupID, &t.Title, &t.Description, &t.Assignee,
		&t.Status, &t.Priority, &t.PlannedStartDate, &t.PlannedEndDate,
		&t.ActualStartDate, &t.ActualEndDate, &t.SortOrder, &t.Metadata, &t.CreatedAt, &t.UpdatedAt)
	return t, err
}

const taskColumns = `id, project_id, group_id, title, description, assignee, status, priority,
	planned_start_date, planned_end_date, actual_start_date, actual_end_date,
	sort_order, metadata, created_at, updated_at`

func listTasks(w http.ResponseWriter, r *http.Request) {
	projectID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid project id")
		return
	}

	query := `SELECT ` + taskColumns + ` FROM tasks WHERE project_id=?`
	args := []interface{}{projectID}

	if gid := r.URL.Query().Get("group_id"); gid != "" {
		query += ` AND group_id=?`
		args = append(args, gid)
	}
	if status := r.URL.Query().Get("status"); status != "" {
		query += ` AND status=?`
		args = append(args, status)
	}
	if assignee := r.URL.Query().Get("assignee"); assignee != "" {
		query += ` AND assignee=?`
		args = append(args, assignee)
	}
	query += ` ORDER BY sort_order`

	rows, err := db.DB.Query(query, args...)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()

	tasks := []db.Task{}
	for rows.Next() {
		t, err := scanTask(rows)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		tasks = append(tasks, t)
	}
	writeJSON(w, http.StatusOK, tasks)
}

func createTask(w http.ResponseWriter, r *http.Request) {
	projectID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid project id")
		return
	}

	var t db.Task
	if err := json.NewDecoder(r.Body).Decode(&t); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	if t.Title == "" {
		writeError(w, http.StatusBadRequest, "title is required")
		return
	}
	if t.Status == "" {
		t.Status = "todo"
	}
	if t.Priority == "" {
		t.Priority = "medium"
	}
	if t.Metadata == "" {
		t.Metadata = "{}"
	}

	// Get next sort_order
	var maxSort int
	if t.GroupID != nil {
		db.DB.QueryRow(`SELECT COALESCE(MAX(sort_order), 0) FROM tasks WHERE group_id=?`, *t.GroupID).Scan(&maxSort)
	} else {
		db.DB.QueryRow(`SELECT COALESCE(MAX(sort_order), 0) FROM tasks WHERE project_id=? AND group_id IS NULL`, projectID).Scan(&maxSort)
	}

	now := db.Now()
	result, err := db.DB.Exec(
		`INSERT INTO tasks (project_id, group_id, title, description, assignee, status, priority,
		 planned_start_date, planned_end_date, actual_start_date, actual_end_date,
		 sort_order, metadata, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		projectID, t.GroupID, t.Title, t.Description, t.Assignee, t.Status, t.Priority,
		t.PlannedStartDate, t.PlannedEndDate, t.ActualStartDate, t.ActualEndDate,
		maxSort+1000, t.Metadata, now, now,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	id, _ := result.LastInsertId()
	t.ID = id
	t.ProjectID = projectID
	t.SortOrder = maxSort + 1000
	t.CreatedAt = now
	t.UpdatedAt = now
	writeJSON(w, http.StatusCreated, t)
}

func getTask(w http.ResponseWriter, r *http.Request) {
	projectID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid project id")
		return
	}
	taskID, err := strconv.ParseInt(chi.URLParam(r, "tid"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid task id")
		return
	}

	t, err := scanTask(db.DB.QueryRow(`SELECT `+taskColumns+` FROM tasks WHERE id=? AND project_id=?`, taskID, projectID))
	if err != nil {
		writeError(w, http.StatusNotFound, "task not found")
		return
	}
	writeJSON(w, http.StatusOK, t)
}

func updateTask(w http.ResponseWriter, r *http.Request) {
	projectID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid project id")
		return
	}
	taskID, err := strconv.ParseInt(chi.URLParam(r, "tid"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid task id")
		return
	}

	var input db.Task
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON")
		return
	}

	now := db.Now()
	result, err := db.DB.Exec(
		`UPDATE tasks SET group_id=?, title=?, description=?, assignee=?, status=?, priority=?,
		 planned_start_date=?, planned_end_date=?, actual_start_date=?, actual_end_date=?,
		 metadata=?, updated_at=? WHERE id=? AND project_id=?`,
		input.GroupID, input.Title, input.Description, input.Assignee, input.Status, input.Priority,
		input.PlannedStartDate, input.PlannedEndDate, input.ActualStartDate, input.ActualEndDate,
		input.Metadata, now, taskID, projectID,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if n, _ := result.RowsAffected(); n == 0 {
		writeError(w, http.StatusNotFound, "task not found")
		return
	}

	input.ID = taskID
	input.ProjectID = projectID
	input.UpdatedAt = now
	writeJSON(w, http.StatusOK, input)
}

func deleteTask(w http.ResponseWriter, r *http.Request) {
	projectID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid project id")
		return
	}
	taskID, err := strconv.ParseInt(chi.URLParam(r, "tid"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid task id")
		return
	}

	result, err := db.DB.Exec(`DELETE FROM tasks WHERE id=? AND project_id=?`, taskID, projectID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if n, _ := result.RowsAffected(); n == 0 {
		writeError(w, http.StatusNotFound, "task not found")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func reorderTasks(w http.ResponseWriter, r *http.Request) {
	projectID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid project id")
		return
	}

	var body struct {
		GroupID *int64  `json:"group_id"`
		Order   []int64 `json:"order"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON")
		return
	}

	for i, tid := range body.Order {
		db.DB.Exec(`UPDATE tasks SET sort_order=?, updated_at=? WHERE id=? AND project_id=?`,
			i*1000, db.Now(), tid, projectID)
	}
	w.WriteHeader(http.StatusNoContent)
}
