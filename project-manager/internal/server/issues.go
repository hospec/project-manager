package server

import (
	"encoding/json"
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

	var input db.Issue
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON")
		return
	}

	now := db.Now()
	result, err := db.DB.Exec(
		`UPDATE issues SET title=?, description=?, assignee=?, status=?, priority=?, due_date=?, metadata=?, updated_at=? WHERE id=? AND project_id=?`,
		input.Title, input.Description, input.Assignee, input.Status, input.Priority, input.DueDate, input.Metadata, now, issueID, projectID,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if n, _ := result.RowsAffected(); n == 0 {
		writeError(w, http.StatusNotFound, "issue not found")
		return
	}
	input.ID = issueID
	input.ProjectID = projectID
	input.UpdatedAt = now
	writeJSON(w, http.StatusOK, input)
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
