package server

import (
	"encoding/json"
	"net/http"
	"strconv"

	"project-manager/internal/db"

	"github.com/go-chi/chi/v5"
)

func listTaskGroups(w http.ResponseWriter, r *http.Request) {
	projectID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid project id")
		return
	}

	rows, err := db.DB.Query(
		`SELECT id, project_id, name, sort_order, metadata, created_at, updated_at
		 FROM task_groups WHERE project_id=? ORDER BY sort_order`, projectID,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()

	groups := []db.TaskGroup{}
	for rows.Next() {
		var g db.TaskGroup
		rows.Scan(&g.ID, &g.ProjectID, &g.Name, &g.SortOrder, &g.Metadata, &g.CreatedAt, &g.UpdatedAt)
		groups = append(groups, g)
	}
	writeJSON(w, http.StatusOK, groups)
}

func createTaskGroup(w http.ResponseWriter, r *http.Request) {
	projectID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid project id")
		return
	}

	var g db.TaskGroup
	if err := json.NewDecoder(r.Body).Decode(&g); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	if g.Name == "" {
		writeError(w, http.StatusBadRequest, "name is required")
		return
	}
	if g.Metadata == "" {
		g.Metadata = "{}"
	}

	// Get max sort_order and add 1000
	var maxSort int
	db.DB.QueryRow(`SELECT COALESCE(MAX(sort_order), 0) FROM task_groups WHERE project_id=?`, projectID).Scan(&maxSort)

	now := db.Now()
	result, err := db.DB.Exec(
		`INSERT INTO task_groups (project_id, name, sort_order, metadata, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
		projectID, g.Name, maxSort+1000, g.Metadata, now, now,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	id, _ := result.LastInsertId()
	g.ID = id
	g.ProjectID = projectID
	g.SortOrder = maxSort + 1000
	g.CreatedAt = now
	g.UpdatedAt = now
	writeJSON(w, http.StatusCreated, g)
}

func updateTaskGroup(w http.ResponseWriter, r *http.Request) {
	projectID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid project id")
		return
	}
	groupID, err := strconv.ParseInt(chi.URLParam(r, "gid"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid group id")
		return
	}

	var input db.TaskGroup
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON")
		return
	}

	now := db.Now()
	result, err := db.DB.Exec(
		`UPDATE task_groups SET name=?, metadata=?, updated_at=? WHERE id=? AND project_id=?`,
		input.Name, input.Metadata, now, groupID, projectID,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if n, _ := result.RowsAffected(); n == 0 {
		writeError(w, http.StatusNotFound, "task group not found")
		return
	}

	input.ID = groupID
	input.ProjectID = projectID
	input.UpdatedAt = now
	writeJSON(w, http.StatusOK, input)
}

func deleteTaskGroup(w http.ResponseWriter, r *http.Request) {
	projectID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid project id")
		return
	}
	groupID, err := strconv.ParseInt(chi.URLParam(r, "gid"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid group id")
		return
	}

	result, err := db.DB.Exec(`DELETE FROM task_groups WHERE id=? AND project_id=?`, groupID, projectID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if n, _ := result.RowsAffected(); n == 0 {
		writeError(w, http.StatusNotFound, "task group not found")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func reorderTaskGroups(w http.ResponseWriter, r *http.Request) {
	projectID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid project id")
		return
	}

	var body struct {
		Order []int64 `json:"order"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON")
		return
	}

	for i, gid := range body.Order {
		db.DB.Exec(`UPDATE task_groups SET sort_order=?, updated_at=? WHERE id=? AND project_id=?`, i*1000, db.Now(), gid, projectID)
	}
	w.WriteHeader(http.StatusNoContent)
}
