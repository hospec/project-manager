package server

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"project-manager/internal/db"

	"github.com/go-chi/chi/v5"
)

// --- Phases ---

func listPhases(w http.ResponseWriter, r *http.Request) {
	rows, err := db.DB.Query(`SELECT id, phase_key, label, color, sort_order, created_at, updated_at FROM project_phases ORDER BY sort_order`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()

	phases := make([]db.ProjectPhase, 0)
	for rows.Next() {
		var p db.ProjectPhase
		if err := rows.Scan(&p.ID, &p.PhaseKey, &p.Label, &p.Color, &p.SortOrder, &p.CreatedAt, &p.UpdatedAt); err != nil {
			continue
		}
		phases = append(phases, p)
	}
	writeJSON(w, http.StatusOK, phases)
}

func createPhase(w http.ResponseWriter, r *http.Request) {
	var input db.ProjectPhase
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	if input.PhaseKey == "" || input.Label == "" {
		writeError(w, http.StatusBadRequest, "phase_key and label are required")
		return
	}
	if input.Color == "" {
		input.Color = "blue"
	}

	// Get max sort_order
	var maxSort int
	db.DB.QueryRow(`SELECT COALESCE(MAX(sort_order), -1) FROM project_phases`).Scan(&maxSort)

	now := db.Now()
	result, err := db.DB.Exec(
		`INSERT INTO project_phases (phase_key, label, color, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
		input.PhaseKey, input.Label, input.Color, maxSort+1, now, now,
	)
	if err != nil {
		writeError(w, http.StatusConflict, fmt.Sprintf("phase key '%s' already exists", input.PhaseKey))
		return
	}

	id, _ := result.LastInsertId()
	input.ID = id
	input.SortOrder = maxSort + 1
	input.CreatedAt = now
	input.UpdatedAt = now
	writeJSON(w, http.StatusCreated, input)
}

func updatePhase(w http.ResponseWriter, r *http.Request) {
	pid, err := strconv.ParseInt(chi.URLParam(r, "pid"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid phase id")
		return
	}

	var input map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON")
		return
	}

	// Fetch existing
	var existing db.ProjectPhase
	err = db.DB.QueryRow(`SELECT id, phase_key, label, color, sort_order, created_at, updated_at FROM project_phases WHERE id=?`, pid).Scan(
		&existing.ID, &existing.PhaseKey, &existing.Label, &existing.Color, &existing.SortOrder, &existing.CreatedAt, &existing.UpdatedAt,
	)
	if err != nil {
		writeError(w, http.StatusNotFound, "phase not found")
		return
	}

	if v, ok := input["label"]; ok {
		existing.Label = fmt.Sprint(v)
	}
	if v, ok := input["color"]; ok {
		existing.Color = fmt.Sprint(v)
	}
	if v, ok := input["sort_order"]; ok {
		if f, ok := v.(float64); ok {
			existing.SortOrder = int(f)
		}
	}

	now := db.Now()
	_, err = db.DB.Exec(`UPDATE project_phases SET label=?, color=?, sort_order=?, updated_at=? WHERE id=?`,
		existing.Label, existing.Color, existing.SortOrder, now, pid)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	existing.UpdatedAt = now
	writeJSON(w, http.StatusOK, existing)
}

func reorderPhases(w http.ResponseWriter, r *http.Request) {
	var items []struct {
		ID        int64 `json:"id"`
		SortOrder int   `json:"sort_order"`
	}
	if err := json.NewDecoder(r.Body).Decode(&items); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON")
		return
	}

	now := db.Now()
	for _, item := range items {
		db.DB.Exec(`UPDATE project_phases SET sort_order=?, updated_at=? WHERE id=?`, item.SortOrder, now, item.ID)
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func deletePhase(w http.ResponseWriter, r *http.Request) {
	pid, err := strconv.ParseInt(chi.URLParam(r, "pid"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid phase id")
		return
	}

	// Check remaining count
	var count int
	db.DB.QueryRow(`SELECT COUNT(*) FROM project_phases`).Scan(&count)
	if count <= 1 {
		writeError(w, http.StatusBadRequest, "must keep at least one phase")
		return
	}

	// Check how many projects reference this phase
	var phaseKey string
	db.DB.QueryRow(`SELECT phase_key FROM project_phases WHERE id=?`, pid).Scan(&phaseKey)

	var refCount int
	db.DB.QueryRow(`SELECT COUNT(*) FROM projects WHERE phase=?`, phaseKey).Scan(&refCount)
	if refCount > 0 {
		writeJSON(w, http.StatusConflict, map[string]interface{}{
			"error": fmt.Sprintf("%d project(s) are using this phase, please reassign them first", refCount),
			"ref_count": refCount,
		})
		return
	}

	_, err = db.DB.Exec(`DELETE FROM project_phases WHERE id=?`, pid)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// --- Personnel ---

func listPersonnel(w http.ResponseWriter, r *http.Request) {
	rows, err := db.DB.Query(`SELECT id, name, title, responsibilities, created_at, updated_at FROM personnel ORDER BY name`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()

	list := make([]db.Personnel, 0)
	for rows.Next() {
		var p db.Personnel
		if err := rows.Scan(&p.ID, &p.Name, &p.Title, &p.Responsibilities, &p.CreatedAt, &p.UpdatedAt); err != nil {
			continue
		}
		list = append(list, p)
	}
	writeJSON(w, http.StatusOK, list)
}

func createPersonnel(w http.ResponseWriter, r *http.Request) {
	var input db.Personnel
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	if input.Name == "" {
		writeError(w, http.StatusBadRequest, "name is required")
		return
	}

	now := db.Now()
	result, err := db.DB.Exec(
		`INSERT INTO personnel (name, title, responsibilities, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
		input.Name, input.Title, input.Responsibilities, now, now,
	)
	if err != nil {
		writeError(w, http.StatusConflict, fmt.Sprintf("person '%s' already exists", input.Name))
		return
	}

	id, _ := result.LastInsertId()
	input.ID = id
	input.CreatedAt = now
	input.UpdatedAt = now
	writeJSON(w, http.StatusCreated, input)
}

func updatePersonnel(w http.ResponseWriter, r *http.Request) {
	pid, err := strconv.ParseInt(chi.URLParam(r, "pid"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid personnel id")
		return
	}

	var input map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON")
		return
	}

	// Fetch existing
	var existing db.Personnel
	err = db.DB.QueryRow(`SELECT id, name, title, responsibilities, created_at, updated_at FROM personnel WHERE id=?`, pid).Scan(
		&existing.ID, &existing.Name, &existing.Title, &existing.Responsibilities, &existing.CreatedAt, &existing.UpdatedAt,
	)
	if err != nil {
		writeError(w, http.StatusNotFound, "personnel not found")
		return
	}

	if v, ok := input["name"]; ok {
		existing.Name = fmt.Sprint(v)
	}
	if v, ok := input["title"]; ok {
		existing.Title = fmt.Sprint(v)
	}
	if v, ok := input["responsibilities"]; ok {
		existing.Responsibilities = fmt.Sprint(v)
	}

	now := db.Now()
	_, err = db.DB.Exec(`UPDATE personnel SET name=?, title=?, responsibilities=?, updated_at=? WHERE id=?`,
		existing.Name, existing.Title, existing.Responsibilities, now, pid)
	if err != nil {
		writeError(w, http.StatusConflict, fmt.Sprintf("person '%s' already exists", existing.Name))
		return
	}

	existing.UpdatedAt = now
	writeJSON(w, http.StatusOK, existing)
}

func deletePersonnel(w http.ResponseWriter, r *http.Request) {
	pid, err := strconv.ParseInt(chi.URLParam(r, "pid"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid personnel id")
		return
	}

	_, err = db.DB.Exec(`DELETE FROM personnel WHERE id=?`, pid)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}
