import type {
  Project, ProjectFormData, ProjectOverview,
  ProjectPhase, Personnel,
  TaskGroup, TaskGroupFormData,
  Task, TaskFormData,
  Issue, IssueFormData,
  Note, NoteFormData,
  CalendarResponse,
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
    let message = body || `${res.status} ${res.statusText}`;
    try {
      const parsed = JSON.parse(body);
      if (parsed.error) message = parsed.error;
    } catch {}
    throw new Error(message);
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
  moveTask: (projectId: number, taskId: number, data: { group_id: number | null; after_task_id?: number | null; before?: boolean }) =>
    request<void>(`${BASE}/projects/${projectId}/tasks/${taskId}/move`, { method: 'PUT', body: JSON.stringify(data) }),

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
  getCalendar: (projectId: number, month: string) =>
    request<CalendarResponse>(`${BASE}/projects/${projectId}/calendar?month=${month}`),
  updateDailyNotes: (projectId: number, taskId: number, date: string, content: string) =>
    request<void>(`${BASE}/projects/${projectId}/tasks/${taskId}/daily-notes`, { method: 'PUT', body: JSON.stringify({ date, content }) }),

  // Settings - Phases
  listPhases: () => request<ProjectPhase[]>(`${BASE}/settings/phases`),
  createPhase: (data: { phase_key: string; label: string; color?: string }) =>
    request<ProjectPhase>(`${BASE}/settings/phases`, { method: 'POST', body: JSON.stringify(data) }),
  updatePhase: (id: number, data: { label?: string; color?: string; sort_order?: number }) =>
    request<ProjectPhase>(`${BASE}/settings/phases/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  reorderPhases: (order: { id: number; sort_order: number }[]) =>
    request<void>(`${BASE}/settings/phases/reorder`, { method: 'PUT', body: JSON.stringify(order) }),
  deletePhase: (id: number) =>
    request<void>(`${BASE}/settings/phases/${id}`, { method: 'DELETE' }),

  // Settings - Personnel
  listPersonnel: () => request<Personnel[]>(`${BASE}/settings/personnel`),
  createPersonnel: (data: { name: string; title?: string; responsibilities?: string }) =>
    request<Personnel>(`${BASE}/settings/personnel`, { method: 'POST', body: JSON.stringify(data) }),
  updatePersonnel: (id: number, data: { name?: string; title?: string; responsibilities?: string }) =>
    request<Personnel>(`${BASE}/settings/personnel/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePersonnel: (id: number) =>
    request<void>(`${BASE}/settings/personnel/${id}`, { method: 'DELETE' }),

  // Excel
  exportTasksExcel: async (projectId: number) => {
    const res = await fetch(`${BASE}/projects/${projectId}/tasks/export/excel`);
    if (!res.ok) throw new Error('导出失败');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tasks.xlsx';
    a.click();
    window.URL.revokeObjectURL(url);
  },
  importTasksExcel: async (projectId: number, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${BASE}/projects/${projectId}/tasks/import/excel`, { method: 'POST', body: formData });
    if (!res.ok) throw new Error('导入失败');
    return res.json();
  },
  confirmImportExcel: async (projectId: number, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${BASE}/projects/${projectId}/tasks/import/excel?confirm=true`, { method: 'POST', body: formData });
    if (!res.ok) throw new Error('确认导入失败');
    return res.json();
  },
  downloadTemplate: async () => {
    const res = await fetch(`${BASE}/tasks/template/excel`);
    if (!res.ok) throw new Error('下载失败');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '任务导入模板.xlsx';
    a.click();
    window.URL.revokeObjectURL(url);
  },

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
