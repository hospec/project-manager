package server

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"project-manager/internal/db"

	"github.com/go-chi/chi/v5"
)

const issueColumns = `id, project_id, title, description, assignee, status, priority, due_date, metadata, created_at, updated_at`

func listIssues(w http.ResponseWriter, r *http.Request) {
	projectID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid project id")
		return
	}

	rows, err := db.DB.Query(`SELECT `+issueColumns+` FROM issues WHERE project_id=? ORDER BY updated_at DESC`, projectID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()

	issues := []db.Issue{}
	for rows.Next() {
		var i db.Issue
		rows.Scan(&i.ID, &i.ProjectID, &i.Title, &i.Description, &i.Assignee, &i.Status, &i.Priority, &i.DueDate, &i.Metadata, &i.CreatedAt, &i.UpdatedAt)
		issues = append(issues, i)
	}
	writeJSON(w, http.StatusOK, issues)
}

func createIssue(w http.ResponseWriter, r *http.Request) {
	projectID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid project id")
		return
	}

	var i db.Issue
	if err := json.NewDecoder(r.Body).Decode(&i); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	if i.Title == "" {
		writeError(w, http.StatusBadRequest, "title is required")
		return
	}
	if i.Status == "" {
		i.Status = "open"
	}
	if i.Priority == "" {
		i.Priority = "medium"
	}
	if i.Metadata == "" {
		i.Metadata = "{}"
	}

	now := db.Now()
	result, err := db.DB.Exec(
		`INSERT INTO issues (project_id, title, description, assignee, status, priority, due_date, metadata, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		projectID, i.Title, i.Description, i.Assignee, i.Status, i.Priority, i.DueDate, i.Metadata, now, now,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	id, _ := result.LastInsertId()
	i.ID = id
	i.ProjectID = projectID
	i.CreatedAt = now
	i.UpdatedAt = now
	writeJSON(w, http.StatusCreated, i)
}

func updateIssue(w http.ResponseWriter, r *http.Request) {
	projectID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid project id")
		return
	}
	issueID, err := strconv.ParseInt(chi.URLParam(r, "iid"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid issue id")
		return
	}

	var input map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON")
		return
	}

	// Fetch existing for partial update support
	var existing db.Issue
	err = db.DB.QueryRow(
		`SELECT `+issueColumns+` FROM issues WHERE id=? AND project_id=?`,
		issueID, projectID,
	).Scan(&existing.ID, &existing.ProjectID, &existing.Title, &existing.Description, &existing.Assignee,
		&existing.Status, &existing.Priority, &existing.DueDate, &existing.Metadata, &existing.CreatedAt, &existing.UpdatedAt)
	if err != nil {
		writeError(w, http.StatusNotFound, "issue not found")
		return
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
	if v, ok := input["due_date"]; ok {
		existing.DueDate = fmt.Sprint(v)
	}
	if v, ok := input["metadata"]; ok {
		existing.Metadata = fmt.Sprint(v)
	}

	now := db.Now()
	result, err := db.DB.Exec(
		`UPDATE issues SET title=?, description=?, assignee=?, status=?, priority=?, due_date=?, metadata=?, updated_at=? WHERE id=? AND project_id=?`,
		existing.Title, existing.Description, existing.Assignee, existing.Status, existing.Priority, existing.DueDate, existing.Metadata, now, issueID, projectID,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if n, _ := result.RowsAffected(); n == 0 {
		writeError(w, http.StatusNotFound, "issue not found")
		return
	}
	existing.UpdatedAt = now
	writeJSON(w, http.StatusOK, existing)
}

func deleteIssue(w http.ResponseWriter, r *http.Request) {
	projectID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid project id")
		return
	}
	issueID, err := strconv.ParseInt(chi.URLParam(r, "iid"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid issue id")
		return
	}

	result, err := db.DB.Exec(`DELETE FROM issues WHERE id=? AND project_id=?`, issueID, projectID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if n, _ := result.RowsAffected(); n == 0 {
		writeError(w, http.StatusNotFound, "issue not found")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
