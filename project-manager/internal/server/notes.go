package server

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"project-manager/internal/db"

	"github.com/go-chi/chi/v5"
)

const noteColumns = `id, project_id, title, content, is_pinned, metadata, created_at, updated_at`

func listNotes(w http.ResponseWriter, r *http.Request) {
	projectID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid project id")
		return
	}

	rows, err := db.DB.Query(`SELECT `+noteColumns+` FROM notes WHERE project_id=? ORDER BY is_pinned DESC, updated_at DESC`, projectID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()

	notes := []db.Note{}
	for rows.Next() {
		var n db.Note
		rows.Scan(&n.ID, &n.ProjectID, &n.Title, &n.Content, &n.IsPinned, &n.Metadata, &n.CreatedAt, &n.UpdatedAt)
		notes = append(notes, n)
	}
	writeJSON(w, http.StatusOK, notes)
}

func createNote(w http.ResponseWriter, r *http.Request) {
	projectID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid project id")
		return
	}

	var n db.Note
	if err := json.NewDecoder(r.Body).Decode(&n); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	if n.Title == "" {
		n.Title = "未命名笔记"
	}
	if n.Metadata == "" {
		n.Metadata = "{}"
	}

	now := db.Now()
	result, err := db.DB.Exec(
		`INSERT INTO notes (project_id, title, content, is_pinned, metadata, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		projectID, n.Title, n.Content, n.IsPinned, n.Metadata, now, now,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	id, _ := result.LastInsertId()
	n.ID = id
	n.ProjectID = projectID
	n.CreatedAt = now
	n.UpdatedAt = now
	writeJSON(w, http.StatusCreated, n)
}

func updateNote(w http.ResponseWriter, r *http.Request) {
	projectID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid project id")
		return
	}
	noteID, err := strconv.ParseInt(chi.URLParam(r, "nid"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid note id")
		return
	}

	var input map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON")
		return
	}

	// Fetch existing for partial update support
	var existing db.Note
	err = db.DB.QueryRow(
		`SELECT `+noteColumns+` FROM notes WHERE id=? AND project_id=?`,
		noteID, projectID,
	).Scan(&existing.ID, &existing.ProjectID, &existing.Title, &existing.Content, &existing.IsPinned,
		&existing.Metadata, &existing.CreatedAt, &existing.UpdatedAt)
	if err != nil {
		writeError(w, http.StatusNotFound, "note not found")
		return
	}

	if v, ok := input["title"]; ok {
		existing.Title = fmt.Sprint(v)
	}
	if v, ok := input["content"]; ok {
		existing.Content = fmt.Sprint(v)
	}
	if v, ok := input["is_pinned"]; ok {
		switch val := v.(type) {
		case bool:
			existing.IsPinned = val
		case float64:
			existing.IsPinned = val != 0
		}
	}
	if v, ok := input["metadata"]; ok {
		existing.Metadata = fmt.Sprint(v)
	}

	now := db.Now()
	result, err := db.DB.Exec(
		`UPDATE notes SET title=?, content=?, is_pinned=?, metadata=?, updated_at=? WHERE id=? AND project_id=?`,
		existing.Title, existing.Content, existing.IsPinned, existing.Metadata, now, noteID, projectID,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if n, _ := result.RowsAffected(); n == 0 {
		writeError(w, http.StatusNotFound, "note not found")
		return
	}
	existing.UpdatedAt = now
	writeJSON(w, http.StatusOK, existing)
}

func deleteNote(w http.ResponseWriter, r *http.Request) {
	projectID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid project id")
		return
	}
	noteID, err := strconv.ParseInt(chi.URLParam(r, "nid"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid note id")
		return
	}

	result, err := db.DB.Exec(`DELETE FROM notes WHERE id=? AND project_id=?`, noteID, projectID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if n, _ := result.RowsAffected(); n == 0 {
		writeError(w, http.StatusNotFound, "note not found")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
