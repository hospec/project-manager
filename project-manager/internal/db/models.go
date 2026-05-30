package db

import "time"

// Project represents a project
type Project struct {
	ID          int64  `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Phase       string `json:"phase"`
	Metadata    string `json:"metadata"`
	CreatedAt   string `json:"created_at"`
	UpdatedAt   string `json:"updated_at"`
}

// TaskGroup represents a task group within a project
type TaskGroup struct {
	ID        int64  `json:"id"`
	ProjectID int64  `json:"project_id"`
	Name      string `json:"name"`
	SortOrder int    `json:"sort_order"`
	Metadata  string `json:"metadata"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
}

// Task represents a task
type Task struct {
	ID              int64  `json:"id"`
	ProjectID       int64  `json:"project_id"`
	GroupID         *int64 `json:"group_id"`
	Title           string `json:"title"`
	Description     string `json:"description"`
	Assignee        string `json:"assignee"`
	Status          string `json:"status"`
	Priority        string `json:"priority"`
	PlannedStartDate string `json:"planned_start_date"`
	PlannedEndDate  string `json:"planned_end_date"`
	ActualStartDate string `json:"actual_start_date"`
	ActualEndDate   string `json:"actual_end_date"`
	SortOrder       int    `json:"sort_order"`
	Progress        string `json:"progress"`
	Metadata        string `json:"metadata"`
	CreatedAt       string `json:"created_at"`
	UpdatedAt       string `json:"updated_at"`
}

// Issue represents an issue/todo item
type Issue struct {
	ID          int64  `json:"id"`
	ProjectID   int64  `json:"project_id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Assignee    string `json:"assignee"`
	Status      string `json:"status"`
	Priority    string `json:"priority"`
	DueDate     string `json:"due_date"`
	Metadata    string `json:"metadata"`
	CreatedAt   string `json:"created_at"`
	UpdatedAt   string `json:"updated_at"`
}

// Note represents a memo/note
type Note struct {
	ID        int64  `json:"id"`
	ProjectID int64  `json:"project_id"`
	Title     string `json:"title"`
	Content   string `json:"content"`
	IsPinned  bool   `json:"is_pinned"`
	Metadata  string `json:"metadata"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
}

// CalendarEvent represents a daily task completion record
type CalendarEvent struct {
	ID               int64  `json:"id"`
	ProjectID        int64  `json:"project_id"`
	TaskID           *int64 `json:"task_id"`
	Date             string `json:"date"`
	CompletionStatus string `json:"completion_status"`
	Notes            string `json:"notes"`
	Metadata         string `json:"metadata"`
	CreatedAt        string `json:"created_at"`
	UpdatedAt        string `json:"updated_at"`
}

// ProjectOverview holds dashboard metrics for a project
type ProjectOverview struct {
	Project            Project            `json:"project"`
	TaskCompletion     TaskCompletionStats `json:"task_completion"`
	Risks              []Task             `json:"risks"`
	UpcomingDeadlines  []DeadlineItem     `json:"upcoming_deadlines"`
	RecentCompletions  int                `json:"recent_completions"`
	OpenIssueCount     int                `json:"open_issue_count"`
}

// TaskCompletionStats holds task completion statistics
type TaskCompletionStats struct {
	Total      int     `json:"total"`
	Done       int     `json:"done"`
	InProgress int     `json:"in_progress"`
	Todo       int     `json:"todo"`
	Blocked    int     `json:"blocked"`
	Percentage float64 `json:"percentage"`
}

// DeadlineItem represents a task with an upcoming deadline
type DeadlineItem struct {
	ID              int64  `json:"id"`
	Title           string `json:"title"`
	Assignee        string `json:"assignee"`
	PlannedEndDate  string `json:"planned_end_date"`
	DaysUntil       int    `json:"days_until"`
}

// ExportData is the versioned export format
type ExportData struct {
	AppVersion    string         `json:"appVersion"`
	SchemaVersion int            `json:"schemaVersion"`
	ExportedAt    string         `json:"exportedAt"`
	Data          ExportPayload  `json:"data"`
}

// ExportPayload holds all exported table data
type ExportPayload struct {
	Projects       []Project       `json:"projects"`
	TaskGroups     []TaskGroup     `json:"task_groups"`
	Tasks          []Task          `json:"tasks"`
	Issues         []Issue         `json:"issues"`
	Notes          []Note          `json:"notes"`
	CalendarEvents []CalendarEvent `json:"calendar_events"`
}

const AppVersion = "1.0.0"
const CurrentSchemaVersion = 1

func Now() string {
	return time.Now().Format("2006-01-02T15:04:05-07:00")
}

func DateNow() string {
	return time.Now().Format("2006-01-02")
}
