package server

import (
	"fmt"
	"io"
	"math"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"project-manager/internal/db"

	"github.com/go-chi/chi/v5"
	"github.com/xuri/excelize/v2"
)

// Excel column headers (in order)
var taskExcelHeaders = []string{
	"任务标题", "任务组", "负责人", "优先级", "状态", "进展情况", "风险", "计划开始", "计划结束", "描述",
}

// Header to field mapping
var headerToField = map[string]string{
	"任务标题": "title",
	"任务组":   "group_name",
	"负责人":   "assignee",
	"优先级":   "priority",
	"状态":    "status",
	"进展情况":  "progress",
	"风险":    "risk",
	"计划开始":  "planned_start_date",
	"计划结束":  "planned_end_date",
	"描述":    "description",
}

// Chinese label to English value mappings for status and priority
var statusLabelToValue = map[string]string{
	"待办":  "todo",
	"进行中": "in_progress",
	"已完成": "done",
	"阻塞":  "blocked",
}

var priorityLabelToValue = map[string]string{
	"低":  "low",
	"中":  "medium",
	"高":  "high",
	"紧急": "critical",
}

// normalizeDate parses various date formats and returns YYYY-MM-DD
func normalizeDate(val string) string {
	val = strings.TrimSpace(val)
	if val == "" {
		return ""
	}

	// Already YYYY-MM-DD format
	if matched, _ := regexp.MatchString(`^\d{4}-\d{2}-\d{2}$`, val); matched {
		return val
	}

	// Handle Excel date serial number (days since 1899-12-30)
	// Float format like "46204" or "46204.5"
	if f, err := strconv.ParseFloat(val, 64); err == nil && f > 36526 && f < 73000 {
		days := int(math.Floor(f))
		excelEpoch := time.Date(1899, 12, 30, 0, 0, 0, 0, time.UTC)
		t := excelEpoch.AddDate(0, 0, days)
		return t.Format("2006-01-02")
	}

	formats := []string{
		"2006/1/2",
		"2006/01/02",
		"2006-1-2",
		"1/2/2006",
		"01/02/2006",
		"01-02-2006",
		"01-02-06",
		"2006年1月2日",
		"2006年01月02日",
		"Jan 2, 2006",
		"2 Jan 2006",
	}

	for _, f := range formats {
		if t, err := time.Parse(f, val); err == nil {
			return t.Format("2006-01-02")
		}
	}

	// Return original if unable to parse
	return val
}

func exportTasksExcel(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid project id")
		return
	}

	f := excelize.NewFile()
	sheet := "Sheet1"

	// Write headers
	for i, h := range taskExcelHeaders {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		f.SetCellValue(sheet, cell, h)
	}

	// Header style
	headerStyle, _ := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{Bold: true, Size: 11},
		Fill: excelize.Fill{Type: "pattern", Color: []string{"#E5E7EB"}, Pattern: 1},
	})
	f.SetCellStyle(sheet, "A1", cellName(len(taskExcelHeaders), 1), headerStyle)

	// Fetch tasks - close rows before making another DB query (SQLite single connection)
	rows, err := db.DB.Query(`SELECT `+taskColumns+` FROM tasks WHERE project_id=? ORDER BY sort_order`, id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	tasks := make([]db.Task, 0)
	for rows.Next() {
		var t db.Task
		if err := rows.Scan(&t.ID, &t.ProjectID, &t.GroupID, &t.Title, &t.Description, &t.Assignee,
			&t.Status, &t.Priority, &t.PlannedStartDate, &t.PlannedEndDate,
			&t.ActualStartDate, &t.ActualEndDate, &t.SortOrder, &t.Progress, &t.Risk, &t.Metadata, &t.CreatedAt, &t.UpdatedAt); err != nil {
			continue
		}
		tasks = append(tasks, t)
	}
	rows.Close()

	// Build group name cache (now safe - rows are closed)
	groupNames := make(map[int64]string)
	grpRows, err := db.DB.Query(`SELECT id, name FROM task_groups WHERE project_id=?`, id)
	if err == nil {
		defer grpRows.Close()
		for grpRows.Next() {
			var gid int64
			var gname string
			grpRows.Scan(&gid, &gname)
			groupNames[gid] = gname
		}
	}

	rowIdx := 2 // data starts at row 2
	for _, t := range tasks {
		groupName := ""
		if t.GroupID != nil {
			groupName = groupNames[*t.GroupID]
		}

		values := []interface{}{
			t.Title, groupName, t.Assignee, t.Priority, t.Status,
			t.Progress, t.Risk, t.PlannedStartDate, t.PlannedEndDate, t.Description,
		}
		for i, v := range values {
			cell, _ := excelize.CoordinatesToCellName(i+1, rowIdx)
			f.SetCellValue(sheet, cell, v)
		}
		rowIdx++
	}

	// Add data validation for priority column (D)
	dvPriority := excelize.NewDataValidation(true)
	dvPriority.SetDropList([]string{"低", "中", "高", "紧急"})
	dvPriority.Sqref = fmt.Sprintf("D2:D%d", rowIdx-1)
	f.AddDataValidation(sheet, dvPriority)

	// Add data validation for status column (E)
	dvStatus := excelize.NewDataValidation(true)
	dvStatus.SetDropList([]string{"待办", "进行中", "已完成", "阻塞"})
	dvStatus.Sqref = fmt.Sprintf("E2:E%d", rowIdx-1)
	f.AddDataValidation(sheet, dvStatus)

	// Auto width for columns
	for i := 1; i <= len(taskExcelHeaders); i++ {
		col, _ := excelize.ColumnNumberToName(i)
		f.SetColWidth(sheet, col, col, 16)
	}

	// Set project name as title
	var projectName string
	db.DB.QueryRow(`SELECT name FROM projects WHERE id=?`, id).Scan(&projectName)
	if projectName == "" {
		projectName = "project"
	}

	w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s-任务清单.xlsx"`, projectName))
	f.Write(w)
}

func getExcelTemplate(w http.ResponseWriter, r *http.Request) {
	f := excelize.NewFile()
	sheet := "Sheet1"

	// Write headers
	for i, h := range taskExcelHeaders {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		f.SetCellValue(sheet, cell, h)
	}

	headerStyle, _ := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{Bold: true, Size: 11},
		Fill: excelize.Fill{Type: "pattern", Color: []string{"#E5E7EB"}, Pattern: 1},
	})
	f.SetCellStyle(sheet, "A1", cellName(len(taskExcelHeaders), 1), headerStyle)

	// Add one example row
	example := []interface{}{"示例任务", "默认分组", "张三", "中", "待办", "50%", "", "2026-01-01", "2026-01-31", "示例描述"}
	for i, v := range example {
		cell, _ := excelize.CoordinatesToCellName(i+1, 2)
		f.SetCellValue(sheet, cell, v)
	}

	// Data validation
	dvPriority := excelize.NewDataValidation(true)
	dvPriority.SetDropList([]string{"低", "中", "高", "紧急"})
	dvPriority.Sqref = "D2:D1000"
	f.AddDataValidation(sheet, dvPriority)

	dvStatus := excelize.NewDataValidation(true)
	dvStatus.SetDropList([]string{"待办", "进行中", "已完成", "阻塞"})
	dvStatus.Sqref = "E2:E1000"
	f.AddDataValidation(sheet, dvStatus)

	for i := 1; i <= len(taskExcelHeaders); i++ {
		col, _ := excelize.ColumnNumberToName(i)
		f.SetColWidth(sheet, col, col, 16)
	}

	w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	w.Header().Set("Content-Disposition", `attachment; filename="任务导入模板.xlsx"`)
	f.Write(w)
}

func importTasksExcel(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid project id")
		return
	}

	// Limit upload size to 10MB
	r.Body = http.MaxBytesReader(w, r.Body, 10<<20)
	if err := r.ParseMultipartForm(10 << 20); err != nil {
		writeError(w, http.StatusBadRequest, "file too large (max 10MB)")
		return
	}

	file, _, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "missing file field")
		return
	}
	defer file.Close()

	fileBytes, err := io.ReadAll(file)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to read file")
		return
	}

	f, err := excelize.OpenReader(strings.NewReader(string(fileBytes)))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid Excel file")
		return
	}
	defer f.Close()

	sheet := f.GetSheetName(0)
	rows, err := f.GetRows(sheet)
	if err != nil {
		writeError(w, http.StatusBadRequest, "failed to read sheet")
		return
	}

	if len(rows) < 2 {
		writeError(w, http.StatusBadRequest, "Excel file must have at least a header row and one data row")
		return
	}

	// Parse header row to get column mapping
	headerRow := rows[0]
	colMap := make(map[string]int) // field -> column index
	for i, h := range headerRow {
		h = strings.TrimSpace(h)
		if field, ok := headerToField[h]; ok {
			colMap[field] = i
		}
	}

	// Build group name -> id mapping
	groupNameToID := make(map[string]int64)
	grpRows, err := db.DB.Query(`SELECT id, name FROM task_groups WHERE project_id=?`, id)
	if err == nil {
		defer grpRows.Close()
		for grpRows.Next() {
			var gid int64
			var gname string
			grpRows.Scan(&gid, &gname)
			groupNameToID[gname] = gid
		}
	}

	// Build existing task title -> task id mapping for update detection
	existingTasks := make(map[string]int64)
	taskRows, err := db.DB.Query(`SELECT id, title FROM tasks WHERE project_id=?`, id)
	if err == nil {
		defer taskRows.Close()
		for taskRows.Next() {
			var tid int64
			var tname string
			taskRows.Scan(&tid, &tname)
			existingTasks[strings.TrimSpace(tname)] = tid
		}
	}

	isConfirm := r.URL.Query().Get("confirm") == "true"

	type importResult struct {
		Index  int    `json:"index"`
		Title  string `json:"title"`
		Action string `json:"action"` // "create", "update", "error"
		Error  string `json:"error,omitempty"`
	}

	results := make([]importResult, 0)
	created, updated, skipped := 0, 0, 0

	validStatuses := map[string]bool{"todo": true, "in_progress": true, "done": true, "blocked": true}
	validPriorities := map[string]bool{"low": true, "medium": true, "high": true, "critical": true}

	for i := 1; i < len(rows); i++ { // skip header
		row := rows[i]
		getVal := func(field string) string {
			if idx, ok := colMap[field]; ok && idx < len(row) {
				return strings.TrimSpace(row[idx])
			}
			return ""
		}

		title := getVal("title")
		if title == "" {
			results = append(results, importResult{Index: i + 1, Title: "(空)", Action: "error", Error: "标题为空"})
			skipped++
			continue
		}

		status := getVal("status")
		if status == "" {
			status = "todo"
		} else if v, ok := statusLabelToValue[status]; ok {
			status = v
		}
		if !validStatuses[status] {
			results = append(results, importResult{Index: i + 1, Title: title, Action: "error", Error: fmt.Sprintf("无效状态: %s", status)})
			skipped++
			continue
		}

		priority := getVal("priority")
		if priority == "" {
			priority = "medium"
		} else if v, ok := priorityLabelToValue[priority]; ok {
			priority = v
		}
		if !validPriorities[priority] {
			results = append(results, importResult{Index: i + 1, Title: title, Action: "error", Error: fmt.Sprintf("无效优先级: %s", priority)})
			skipped++
			continue
		}

		// Determine action
		action := "create"
		if _, exists := existingTasks[title]; exists {
			action = "update"
		}

		results = append(results, importResult{Index: i + 1, Title: title, Action: action})

		if isConfirm {
			groupName := getVal("group_name")
			assignee := getVal("assignee")
			progress := getVal("progress")
			risk := getVal("risk")
			plannedStart := normalizeDate(getVal("planned_start_date"))
			plannedEnd := normalizeDate(getVal("planned_end_date"))
			description := getVal("description")

			var groupID *int64
			if groupName != "" {
				if gid, ok := groupNameToID[groupName]; ok {
					groupID = &gid
				} else {
					// Create group on the fly
					now := db.Now()
					result, err := db.DB.Exec(`INSERT INTO task_groups (project_id, name, sort_order, metadata, created_at, updated_at) VALUES (?, ?, 0, '{}', ?, ?)`,
						id, groupName, now, now)
					if err == nil {
						gid, _ := result.LastInsertId()
						groupID = &gid
						groupNameToID[groupName] = gid
					}
				}
			}

			if action == "create" {
				// Get max sort_order
				var maxSort int
				db.DB.QueryRow(`SELECT COALESCE(MAX(sort_order), 0) FROM tasks WHERE project_id=?`, id).Scan(&maxSort)
				now := db.Now()
				_, err := db.DB.Exec(
					`INSERT INTO tasks (project_id, group_id, title, description, assignee, status, priority,
					 planned_start_date, planned_end_date, sort_order, progress, risk, metadata, created_at, updated_at)
					 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '{}', ?, ?)`,
					id, groupID, title, description, assignee, status, priority,
					plannedStart, plannedEnd, maxSort+1000, progress, risk, now, now,
				)
				if err != nil {
					results[len(results)-1].Action = "error"
					results[len(results)-1].Error = err.Error()
					skipped++
					continue
				}
				created++
			} else {
				now := db.Now()
				_, err := db.DB.Exec(
					`UPDATE tasks SET group_id=?, description=?, assignee=?, status=?, priority=?,
					 planned_start_date=?, planned_end_date=?, progress=?, risk=?, updated_at=?
					 WHERE id=? AND project_id=?`,
					groupID, description, assignee, status, priority,
					plannedStart, plannedEnd, progress, risk, now, existingTasks[title], id,
				)
				if err != nil {
					results[len(results)-1].Action = "error"
					results[len(results)-1].Error = err.Error()
					skipped++
					continue
				}
				updated++
			}
		}
	}

	if isConfirm {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"created": created,
			"updated": updated,
			"skipped": skipped,
			"results": results,
		})
	} else {
		var newCount, modifiedCount, errorCount int
		for _, r := range results {
			switch r.Action {
			case "create":
				newCount++
			case "update":
				modifiedCount++
			case "error":
				errorCount++
			}
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"preview":  true,
			"results":  results,
			"total":    len(results),
			"new":      newCount,
			"modified": modifiedCount,
			"errors":   errorCount,
		})
	}
}

// Helper: cell name from column number and row number
func cellName(col, row int) string {
	name, _ := excelize.CoordinatesToCellName(col, row)
	return name
}
