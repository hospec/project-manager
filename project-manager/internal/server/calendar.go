package server

import (
	"encoding/json"
	"net/http"
	"strconv"

	"project-manager/internal/db"

	"github.com/go-chi/chi/v5"
)

func getCalendarEvents(w http.ResponseWriter, r *http.Request) {
	projectID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid project id")
		return
	}

	start := r.URL.Query().Get("start")
	end := r.URL.Query().Get("end")
	if start == "" || end == "" {
		writeError(w, http.StatusBadRequest, "start and end query params required")
		return
	}

	// Get tasks that have planned dates within the range
	rows, err := db.DB.Query(
		`SELECT `+taskColumns+` FROM tasks
		 WHERE project_id=? AND planned_start_date != '' AND planned_end_date != ''
		 AND planned_start_date <= ? AND planned_end_date >= ?`,
		projectID, end, start,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()

	type CalendarEventResponse struct {
		db.Task
		CompletionRecords []db.CalendarEvent `json:"completion_records,omitempty"`
	}

	events := make([]CalendarEventResponse, 0)
	for rows.Next() {
		t, err := scanTask(rows)
		if err != nil {
			continue
		}
		evt := CalendarEventResponse{Task: t}
		events = append(events, evt)
	}
	rows.Close()

	// Now fetch completion records for each task (can't query inside rows loop with MaxOpenConns=1)
	for i := range events {
		crRows, err := db.DB.Query(
			`SELECT id, project_id, task_id, date, completion_status, notes, metadata, created_at, updated_at
			 FROM calendar_events WHERE task_id=? AND date >= ? AND date <= ? ORDER BY date`,
			events[i].ID, start, end,
		)
		if err == nil {
			for crRows.Next() {
				var cr db.CalendarEvent
				crRows.Scan(&cr.ID, &cr.ProjectID, &cr.TaskID, &cr.Date, &cr.CompletionStatus, &cr.Notes, &cr.Metadata, &cr.CreatedAt, &cr.UpdatedAt)
				events[i].CompletionRecords = append(events[i].CompletionRecords, cr)
			}
			crRows.Close()
		}
	}

	writeJSON(w, http.StatusOK, events)
}

func recordCompletion(w http.ResponseWriter, r *http.Request) {
	projectID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid project id")
		return
	}

	var input struct {
		TaskID           *int64 `json:"task_id"`
		Date             string `json:"date"`
		CompletionStatus string `json:"completion_status"`
		Notes            string `json:"notes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	if input.Date == "" {
		writeError(w, http.StatusBadRequest, "date is required")
		return
	}
	if input.CompletionStatus == "" {
		input.CompletionStatus = "partial"
	}

	// Upsert: if record exists for this task+date, update; else insert
	now := db.Now()
	if input.TaskID != nil {
		var existingID int64
		err := db.DB.QueryRow(
			`SELECT id FROM calendar_events WHERE project_id=? AND task_id=? AND date=?`,
			projectID, *input.TaskID, input.Date,
		).Scan(&existingID)

		if err == nil {
			db.DB.Exec(
				`UPDATE calendar_events SET completion_status=?, notes=?, updated_at=? WHERE id=?`,
				input.CompletionStatus, input.Notes, now, existingID,
			)
			writeJSON(w, http.StatusOK, map[string]interface{}{"id": existingID, "updated": true})
			return
		}
	}

	result, err := db.DB.Exec(
		`INSERT INTO calendar_events (project_id, task_id, date, completion_status, notes, metadata, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, '{}', ?, ?)`,
		projectID, input.TaskID, input.Date, input.CompletionStatus, input.Notes, now, now,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	id, _ := result.LastInsertId()
	writeJSON(w, http.StatusCreated, map[string]interface{}{"id": id, "created": true})
}
