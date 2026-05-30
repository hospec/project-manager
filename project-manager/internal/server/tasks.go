package server

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"project-manager/internal/db"

	"github.com/go-chi/chi/v5"
)

func scanTask(scanner RowScanner) (db.Task, error) {
	var t db.Task
	err := scanner.Scan(&t.ID, &t.ProjectID, &t.GroupID, &t.Title, &t.Description, &t.Assignee,
		&t.Status, &t.Priority, &t.PlannedStartDate, &t.PlannedEndDate,
		&t.ActualStartDate, &t.ActualEndDate, &t.SortOrder, &t.Progress, &t.Metadata, &t.CreatedAt, &t.UpdatedAt)
	return t, err
}

const taskColumns = `id, project_id, group_id, title, description, assignee, status, priority,
	planned_start_date, planned_end_date, actual_start_date, actual_end_date,
	sort_order, progress, metadata, created_at, updated_at`

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
		 sort_order, progress, metadata, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		projectID, t.GroupID, t.Title, t.Description, t.Assignee, t.Status, t.Priority,
		t.PlannedStartDate, t.PlannedEndDate, t.ActualStartDate, t.ActualEndDate,
		maxSort+1000, t.Progress, t.Metadata, now, now,
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

	// Fetch existing task first
	existing, err := scanTask(db.DB.QueryRow(
		`SELECT `+taskColumns+` FROM tasks WHERE id=? AND project_id=?`, taskID, projectID))
	if err != nil {
		writeError(w, http.StatusNotFound, "task not found")
		return
	}

	// Decode partial update as a map to only apply provided fields
	var input map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON")
		return
	}

	// Merge: only override fields present in the input
	if v, ok := input["group_id"]; ok {
		if v == nil {
			existing.GroupID = nil
		} else if f, ok := v.(float64); ok {
			gid := int64(f)
			existing.GroupID = &gid
		}
	}
	if v, ok := input["title"]; ok {
		existing.Title = fmt.Sprint(v)
	}
	if v, ok := input["description"]; ok {
		existing.Description = fmt.Sprint(v)
	}
	if v, ok := input["assignee"]; ok {
		existing.Assignee = fmt.Sprint(v)
	}
	if v, ok := input["status"]; ok {
		existing.Status = fmt.Sprint(v)
	}
	if v, ok := input["priority"]; ok {
		existing.Priority = fmt.Sprint(v)
	}
	if v, ok := input["planned_start_date"]; ok {
		existing.PlannedStartDate = fmt.Sprint(v)
	}
	if v, ok := input["planned_end_date"]; ok {
		existing.PlannedEndDate = fmt.Sprint(v)
	}
	if v, ok := input["actual_start_date"]; ok {
		existing.ActualStartDate = fmt.Sprint(v)
	}
	if v, ok := input["actual_end_date"]; ok {
		existing.ActualEndDate = fmt.Sprint(v)
	}
	if v, ok := input["sort_order"]; ok {
		if f, ok := v.(float64); ok {
			existing.SortOrder = int(f)
		}
	}
	if v, ok := input["progress"]; ok {
		existing.Progress = fmt.Sprint(v)
	}
	if v, ok := input["metadata"]; ok {
		existing.Metadata = fmt.Sprint(v)
	}

	now := db.Now()
	result, err := db.DB.Exec(
		`UPDATE tasks SET group_id=?, title=?, description=?, assignee=?, status=?, priority=?,
		 planned_start_date=?, planned_end_date=?, actual_start_date=?, actual_end_date=?,
		 sort_order=?, progress=?, metadata=?, updated_at=? WHERE id=? AND project_id=?`,
		existing.GroupID, existing.Title, existing.Description, existing.Assignee, existing.Status, existing.Priority,
		existing.PlannedStartDate, existing.PlannedEndDate, existing.ActualStartDate, existing.ActualEndDate,
		existing.SortOrder, existing.Progress, existing.Metadata, now, taskID, projectID,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if n, _ := result.RowsAffected(); n == 0 {
		writeError(w, http.StatusNotFound, "task not found")
		return
	}

	existing.UpdatedAt = now
	writeJSON(w, http.StatusOK, existing)
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

func moveTask(w http.ResponseWriter, r *http.Request) {
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

	var body struct {
		GroupID     *int64 `json:"group_id"`
		AfterTaskID *int64 `json:"after_task_id"`
		Before      bool   `json:"before"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON")
		return
	}

	// Verify the task exists
	task, err := scanTask(db.DB.QueryRow(
		`SELECT `+taskColumns+` FROM tasks WHERE id=? AND project_id=?`, taskID, projectID))
	if err != nil {
		writeError(w, http.StatusNotFound, "task not found")
		return
	}

	// Calculate new sort_order
	var newSortOrder int
	if body.AfterTaskID != nil {
		var refSort int
		err := db.DB.QueryRow(`SELECT sort_order FROM tasks WHERE id=? AND project_id=?`,
			*body.AfterTaskID, projectID).Scan(&refSort)
		if err != nil {
			writeError(w, http.StatusNotFound, "reference task not found")
			return
		}
		if body.Before {
			newSortOrder = refSort
		} else {
			newSortOrder = refSort + 1
		}
	} else {
		// Append to end of target group
		var maxSort int
		if body.GroupID != nil {
			db.DB.QueryRow(`SELECT COALESCE(MAX(sort_order), 0) FROM tasks WHERE group_id=? AND project_id=?`,
				*body.GroupID, projectID).Scan(&maxSort)
		} else {
			db.DB.QueryRow(`SELECT COALESCE(MAX(sort_order), 0) FROM tasks WHERE project_id=? AND group_id IS NULL`,
				projectID).Scan(&maxSort)
		}
		newSortOrder = maxSort + 1000
	}

	now := db.Now()
	_, err = db.DB.Exec(`UPDATE tasks SET group_id=?, sort_order=?, updated_at=? WHERE id=? AND project_id=?`,
		body.GroupID, newSortOrder, now, taskID, projectID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("move task: %v", err))
		return
	}

	// Re-number all tasks in target group to maintain clean spacing
	renumberTasksInGroup(projectID, body.GroupID)
	// Also re-number old group if task moved between groups
	oldGroupID := task.GroupID
	if (oldGroupID == nil && body.GroupID != nil) || (oldGroupID != nil && body.GroupID == nil) ||
		(oldGroupID != nil && body.GroupID != nil && *oldGroupID != *body.GroupID) {
		renumberTasksInGroup(projectID, oldGroupID)
	}

	w.WriteHeader(http.StatusNoContent)
}

func renumberTasksInGroup(projectID int64, groupID *int64) {
	var rows *sql.Rows
	var err error
	if groupID != nil {
		rows, err = db.DB.Query(`SELECT id FROM tasks WHERE project_id=? AND group_id=? ORDER BY sort_order, id`,
			projectID, *groupID)
	} else {
		rows, err = db.DB.Query(`SELECT id FROM tasks WHERE project_id=? AND group_id IS NULL ORDER BY sort_order, id`,
			projectID)
	}
	if err != nil {
		return
	}

	var ids []int64
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			continue
		}
		ids = append(ids, id)
	}
	rows.Close()

	for i, id := range ids {
		db.DB.Exec(`UPDATE tasks SET sort_order=? WHERE id=?`, i*1000, id)
	}
}
