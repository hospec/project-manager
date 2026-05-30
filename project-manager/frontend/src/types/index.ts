export interface Project {
  id: number;
  name: string;
  description: string;
  phase: 'planning' | 'execution' | 'monitoring' | 'closure';
  metadata: string;
  created_at: string;
  updated_at: string;
}

export interface TaskGroup {
  id: number;
  project_id: number;
  name: string;
  sort_order: number;
  progress: string;
  metadata: string;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: number;
  project_id: number;
  group_id: number | null;
  title: string;
  description: string;
  assignee: string;
  status: 'todo' | 'in_progress' | 'done' | 'blocked';
  priority: 'low' | 'medium' | 'high' | 'critical';
  planned_start_date: string;
  planned_end_date: string;
  actual_start_date: string;
  actual_end_date: string;
  sort_order: number;
  progress: string;
  metadata: string;
  created_at: string;
  updated_at: string;
}

export interface Issue {
  id: number;
  project_id: number;
  title: string;
  description: string;
  assignee: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  due_date: string;
  metadata: string;
  created_at: string;
  updated_at: string;
}

export interface Note {
  id: number;
  project_id: number;
  title: string;
  content: string;
  is_pinned: boolean;
  metadata: string;
  created_at: string;
  updated_at: string;
}

export interface CalendarEventData extends Task {
  completion_records?: CalendarEvent[];
}

export interface CalendarEvent {
  id: number;
  project_id: number;
  task_id: number | null;
  date: string;
  completion_status: 'full' | 'partial' | 'none';
  notes: string;
  metadata: string;
  created_at: string;
  updated_at: string;
}

export interface TaskCompletionStats {
  total: number;
  done: number;
  in_progress: number;
  todo: number;
  blocked: number;
  percentage: number;
}

export interface DeadlineItem {
  id: number;
  title: string;
  assignee: string;
  planned_end_date: string;
  days_until: number;
}

export interface ProjectOverview {
  project: Project;
  task_completion: TaskCompletionStats;
  risks: Task[];
  upcoming_deadlines: DeadlineItem[];
  recent_completions: number;
  open_issue_count: number;
}

export interface ExportData {
  appVersion: string;
  schemaVersion: number;
  exportedAt: string;
  data: {
    projects: Project[];
    task_groups: TaskGroup[];
    tasks: Task[];
    issues: Issue[];
    notes: Note[];
    calendar_events: CalendarEvent[];
  };
}

// Form data types (omit auto-generated fields)
export type ProjectFormData = Omit<Project, 'id' | 'created_at' | 'updated_at'>;
export type TaskGroupFormData = Omit<TaskGroup, 'id' | 'project_id' | 'created_at' | 'updated_at'>;
export type TaskFormData = Omit<Task, 'id' | 'project_id' | 'created_at' | 'updated_at'>;
export type IssueFormData = Omit<Issue, 'id' | 'project_id' | 'created_at' | 'updated_at'>;
export type NoteFormData = Omit<Note, 'id' | 'project_id' | 'created_at' | 'updated_at'>;
