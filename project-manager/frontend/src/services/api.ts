import type {
  Project, ProjectFormData, ProjectOverview,
  TaskGroup, TaskGroupFormData,
  Task, TaskFormData,
  Issue, IssueFormData,
  Note, NoteFormData,
  CalendarEvent, CalendarEventData,
  ExportData,
} from '../types';

const BASE = '/api/v1';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `${res.status} ${res.statusText}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// Projects
export const api = {
  // Projects
  listProjects: () => request<Project[]>(`${BASE}/projects`),
  createProject: (data: ProjectFormData) =>
    request<Project>(`${BASE}/projects`, { method: 'POST', body: JSON.stringify(data) }),
  getProject: (id: number) => request<Project>(`${BASE}/projects/${id}`),
  updateProject: (id: number, data: Partial<ProjectFormData>) =>
    request<Project>(`${BASE}/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProject: (id: number) =>
    request<void>(`${BASE}/projects/${id}`, { method: 'DELETE' }),
  getOverview: (id: number) => request<ProjectOverview>(`${BASE}/projects/${id}/overview`),

  // Task Groups
  listTaskGroups: (projectId: number) =>
    request<TaskGroup[]>(`${BASE}/projects/${projectId}/task-groups`),
  createTaskGroup: (projectId: number, data: TaskGroupFormData) =>
    request<TaskGroup>(`${BASE}/projects/${projectId}/task-groups`, { method: 'POST', body: JSON.stringify(data) }),
  updateTaskGroup: (projectId: number, groupId: number, data: Partial<TaskGroupFormData>) =>
    request<TaskGroup>(`${BASE}/projects/${projectId}/task-groups/${groupId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTaskGroup: (projectId: number, groupId: number) =>
    request<void>(`${BASE}/projects/${projectId}/task-groups/${groupId}`, { method: 'DELETE' }),
  reorderTaskGroups: (projectId: number, order: number[]) =>
    request<void>(`${BASE}/projects/${projectId}/task-groups/reorder`, { method: 'PUT', body: JSON.stringify({ order }) }),

  // Tasks
  listTasks: (projectId: number, params?: { group_id?: number; status?: string; assignee?: string }) => {
    const qs = new URLSearchParams();
    if (params?.group_id) qs.set('group_id', String(params.group_id));
    if (params?.status) qs.set('status', params.status);
    if (params?.assignee) qs.set('assignee', params.assignee);
    const query = qs.toString();
    return request<Task[]>(`${BASE}/projects/${projectId}/tasks${query ? '?' + query : ''}`);
  },
  createTask: (projectId: number, data: TaskFormData) =>
    request<Task>(`${BASE}/projects/${projectId}/tasks`, { method: 'POST', body: JSON.stringify(data) }),
  getTask: (projectId: number, taskId: number) =>
    request<Task>(`${BASE}/projects/${projectId}/tasks/${taskId}`),
  updateTask: (projectId: number, taskId: number, data: Partial<TaskFormData>) =>
    request<Task>(`${BASE}/projects/${projectId}/tasks/${taskId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTask: (projectId: number, taskId: number) =>
    request<void>(`${BASE}/projects/${projectId}/tasks/${taskId}`, { method: 'DELETE' }),
  reorderTasks: (projectId: number, groupId: number, order: number[]) =>
    request<void>(`${BASE}/projects/${projectId}/tasks/reorder`, { method: 'PUT', body: JSON.stringify({ group_id: groupId, order }) }),

  // Issues
  listIssues: (projectId: number) =>
    request<Issue[]>(`${BASE}/projects/${projectId}/issues`),
  createIssue: (projectId: number, data: IssueFormData) =>
    request<Issue>(`${BASE}/projects/${projectId}/issues`, { method: 'POST', body: JSON.stringify(data) }),
  updateIssue: (projectId: number, issueId: number, data: Partial<IssueFormData>) =>
    request<Issue>(`${BASE}/projects/${projectId}/issues/${issueId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteIssue: (projectId: number, issueId: number) =>
    request<void>(`${BASE}/projects/${projectId}/issues/${issueId}`, { method: 'DELETE' }),

  // Notes
  listNotes: (projectId: number) =>
    request<Note[]>(`${BASE}/projects/${projectId}/notes`),
  createNote: (projectId: number, data: NoteFormData) =>
    request<Note>(`${BASE}/projects/${projectId}/notes`, { method: 'POST', body: JSON.stringify(data) }),
  updateNote: (projectId: number, noteId: number, data: Partial<NoteFormData>) =>
    request<Note>(`${BASE}/projects/${projectId}/notes/${noteId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteNote: (projectId: number, noteId: number) =>
    request<void>(`${BASE}/projects/${projectId}/notes/${noteId}`, { method: 'DELETE' }),

  // Calendar
  getCalendarEvents: (projectId: number, start: string, end: string) =>
    request<CalendarEventData[]>(`${BASE}/projects/${projectId}/calendar?start=${start}&end=${end}`),
  recordCompletion: (projectId: number, data: { task_id?: number; date: string; completion_status: string; notes?: string }) =>
    request<CalendarEvent>(`${BASE}/projects/${projectId}/calendar/complete`, { method: 'POST', body: JSON.stringify(data) }),

  // Import/Export
  exportProject: (projectId: number) =>
    request<ExportData>(`${BASE}/export/project/${projectId}`),
  exportAll: () =>
    request<ExportData>(`${BASE}/export/all`),
  importData: async (file: File) => {
    const text = await file.text();
    const data = JSON.parse(text);
    return request<{ message: string; imported: Record<string, number> }>(`${BASE}/import`, { method: 'POST', body: JSON.stringify(data) });
  },
};
