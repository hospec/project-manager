package server

import (
	"encoding/json"
	"net/http"
	"strconv"

	"project-manager/internal/db"

	"github.com/go-chi/chi/v5"
)

// CalendarTask is a task with its daily notes for a date range
type CalendarTask struct {
	db.Task
	DailyNotes map[string]string `json:"daily_notes"` // date -> content
}

// CalendarResponse is the full calendar response for a month
type CalendarResponse struct {
	Tasks []CalendarTask `json:"tasks"`
}

func getCalendar(w http.ResponseWriter, r *http.Request) {
	projectID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid project id")
		return
	}

	// month format: 2026-06
	month := r.URL.Query().Get("month")
	if month == "" {
		writeError(w, http.StatusBadRequest, "month query param required (YYYY-MM)")
		return
	}

	// Get ALL tasks that have dates overlapping this month
	monthStart := month + "-01"
	monthEnd := month + "-31" // SQLite will handle invalid dates gracefully

	rows, err := db.DB.Query(
		`SELECT `+taskColumns+` FROM tasks
		 WHERE project_id=? AND planned_start_date != '' AND planned_end_date != ''
		 AND planned_start_date <= ? AND planned_end_date >= ?
		 ORDER BY sort_order`,
		projectID, monthEnd, monthStart,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()

	tasks := make([]CalendarTask, 0)
	for rows.Next() {
		t, err := scanTask(rows)
		if err != nil {
			continue
		}
		ct := CalendarTask{Task: t, DailyNotes: make(map[string]string)}
		tasks = append(tasks, ct)
	}
	rows.Close()

	// Fetch daily notes for all tasks in one go
	taskIDs := make([]interface{}, 0)
	placeholders := ""
	for i, t := range tasks {
		if i > 0 {
			placeholders += ","
		}
		placeholders += "?"
		taskIDs = append(taskIDs, t.ID)
	}

	if len(taskIDs) > 0 {
		dnRows, err := db.DB.Query(
			`SELECT task_id, date, content FROM task_daily_notes
			 WHERE task_id IN (`+placeholders+`) AND date >= ? AND date <= ?`,
			append(taskIDs, monthStart, monthEnd)...,
		)
		if err == nil {
			defer dnRows.Close()
			for dnRows.Next() {
				var taskID int64
				var date, content string
				dnRows.Scan(&taskID, &date, &content)
				for i := range tasks {
					if tasks[i].ID == taskID {
						tasks[i].DailyNotes[date] = content
						break
					}
				}
			}
			dnRows.Close()
		}
	}

	writeJSON(w, http.StatusOK, CalendarResponse{Tasks: tasks})
}

func updateDailyNotes(w http.ResponseWriter, r *http.Request) {
	taskID, err := strconv.ParseInt(chi.URLParam(r, "tid"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid task id")
		return
	}
	projectID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid project id")
		return
	}

	var input struct {
		Date    string `json:"date"`
		Content string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	if input.Date == "" {
		writeError(w, http.StatusBadRequest, "date is required")
		return
	}

	now := db.Now()
	_, err = db.DB.Exec(
		`INSERT INTO task_daily_notes (task_id, project_id, date, content, updated_at)
		 VALUES (?, ?, ?, ?, ?)
		 ON CONFLICT(task_id, date) DO UPDATE SET content=?, updated_at=?`,
		taskID, projectID, input.Date, input.Content, now, input.Content, now,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{"ok": true})
}
