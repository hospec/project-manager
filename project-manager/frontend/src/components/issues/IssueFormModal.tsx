import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../../services/api';
import type { IssueFormData, Personnel } from '../../types';
import Modal from '../common/Modal';

const statuses = [
  { value: 'open', label: '未处理' },
  { value: 'in_progress', label: '处理中' },
  { value: 'resolved', label: '已解决' },
  { value: 'closed', label: '已关闭' },
];
const priorities = [
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
  { value: 'critical', label: '紧急' },
];

interface Props {
  projectId: number;
  issueId: number | null;
  onClose: () => void;
}

export default function IssueFormModal({ projectId, issueId, onClose }: Props) {
  const queryClient = useQueryClient();
  const isEdit = issueId !== null;

  const { data: allIssues = [] } = useQuery({
    queryKey: ['issues', projectId],
    queryFn: () => api.listIssues(projectId),
  });

  const issue = isEdit ? allIssues.find((i) => i.id === issueId) : null;

  const { data: personnel = [] } = useQuery<Personnel[]>({
    queryKey: ['personnel'],
    queryFn: api.listPersonnel,
    staleTime: 5 * 60 * 1000,
  });

  const [form, setForm] = useState<IssueFormData>({
    title: '', description: '', assignee: '', status: 'open', priority: 'medium', due_date: '', metadata: '{}',
  });

  useEffect(() => {
    if (issue) {
      setForm({
        title: issue.title, description: issue.description, assignee: issue.assignee,
        status: issue.status as IssueFormData['status'], priority: issue.priority as IssueFormData['priority'],
        due_date: issue.due_date, metadata: issue.metadata,
      });
    }
  }, [issue]);

  const createMutation = useMutation({
    mutationFn: () => api.createIssue(projectId, form),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['issues', projectId] }); toast.success('问题已创建'); onClose(); },
    onError: () => toast.error('创建失败'),
  });

  const updateMutation = useMutation({
    mutationFn: () => api.updateIssue(projectId, issueId!, form),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['issues', projectId] }); toast.success('问题已更新'); onClose(); },
    onError: () => toast.error('更新失败'),
  });

  return (
    <Modal open onClose={onClose} title={isEdit ? '编辑问题' : '新建问题'}>
      <form onSubmit={(e) => { e.preventDefault(); if (!form.title.trim()) return; isEdit ? updateMutation.mutate() : createMutation.mutate(); }} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">标题 *</label>
          <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500" autoFocus />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500" rows={3} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">责任人</label>
            <input type="text" value={form.assignee} list="personnel-list"
              onChange={(e) => setForm({ ...form, assignee: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500" placeholder="输入姓名或从列表选择" />
            <datalist id="personnel-list">
              {personnel.map(p => (
                <option key={p.id} value={p.name}>{p.title ? `${p.name} — ${p.title}` : p.name}</option>
              ))}
            </datalist>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">截止日期</label>
            <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">状态</label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as IssueFormData['status'] })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500">
              {statuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">优先级</label>
            <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as IssueFormData['priority'] })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500">
              {priorities.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-700 border rounded-lg hover:bg-gray-50">取消</button>
          <button type="submit" className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            {isEdit ? '保存' : '创建'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
