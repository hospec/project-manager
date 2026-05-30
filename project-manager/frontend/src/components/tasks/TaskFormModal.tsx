import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../../services/api';
import type { TaskFormData } from '../../types';
import Modal from '../common/Modal';

const statuses = [
  { value: 'todo', label: '待办' },
  { value: 'in_progress', label: '进行中' },
  { value: 'done', label: '已完成' },
  { value: 'blocked', label: '阻塞' },
];

const priorities = [
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
  { value: 'critical', label: '紧急' },
];

interface Props {
  projectId: number;
  taskId: number | null;
  groupId?: number | null;
  onClose: () => void;
}

export default function TaskFormModal({ projectId, taskId, groupId, onClose }: Props) {
  const queryClient = useQueryClient();
  const isEdit = taskId !== null;

  const { data: task } = useQuery({
    queryKey: ['tasks', projectId, taskId],
    queryFn: () => api.getTask(projectId, taskId!),
    enabled: isEdit,
  });

  const { data: groups = [] } = useQuery({
    queryKey: ['task-groups', projectId],
    queryFn: () => api.listTaskGroups(projectId),
  });

  const [form, setForm] = useState<TaskFormData>({
    title: '', description: '', assignee: '', status: 'todo', priority: 'medium',
    planned_start_date: '', planned_end_date: '', actual_start_date: '', actual_end_date: '',
    group_id: groupId ?? null, sort_order: 0, metadata: '{}',
  });

  useEffect(() => {
    if (task) {
      setForm({
        title: task.title, description: task.description, assignee: task.assignee,
        status: task.status, priority: task.priority,
        planned_start_date: task.planned_start_date, planned_end_date: task.planned_end_date,
        actual_start_date: task.actual_start_date, actual_end_date: task.actual_end_date,
        group_id: task.group_id, sort_order: task.sort_order, metadata: task.metadata,
      });
    }
  }, [task]);

  const createMutation = useMutation({
    mutationFn: () => api.createTask(projectId, form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['overview', projectId] });
      toast.success('任务已创建');
      onClose();
    },
    onError: () => toast.error('创建失败'),
  });

  const updateMutation = useMutation({
    mutationFn: () => api.updateTask(projectId, taskId!, form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['overview', projectId] });
      toast.success('任务已更新');
      onClose();
    },
    onError: () => toast.error('更新失败'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    if (form.planned_start_date && form.planned_end_date && form.planned_end_date < form.planned_start_date) {
      toast.error('计划完成日期不能早于计划开始日期');
      return;
    }
    if (form.actual_start_date && form.actual_end_date && form.actual_end_date < form.actual_start_date) {
      toast.error('实际完成日期不能早于实际开始日期');
      return;
    }
    if (isEdit) updateMutation.mutate();
    else createMutation.mutate();
  };

  return (
    <Modal open onClose={onClose} title={isEdit ? '编辑任务' : '新建任务'} width="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">任务标题 *</label>
            <input
              type="text" value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              placeholder="输入任务标题" autoFocus
            />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500" rows={2}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">责任人</label>
            <input
              type="text" value={form.assignee}
              onChange={(e) => setForm({ ...form, assignee: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500" placeholder="姓名"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">任务组</label>
            <select
              value={form.group_id ?? ''}
              onChange={(e) => setForm({ ...form, group_id: e.target.value ? Number(e.target.value) : null })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            >
              <option value="">未分组</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">状态</label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as TaskFormData['status'] })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            >
              {statuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">优先级</label>
            <select
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value as TaskFormData['priority'] })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            >
              {priorities.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">计划开始</label>
            <input type="date" value={form.planned_start_date}
              onChange={(e) => setForm({ ...form, planned_start_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">计划完成</label>
            <input type="date" value={form.planned_end_date}
              onChange={(e) => setForm({ ...form, planned_end_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-700 border rounded-lg hover:bg-gray-50">取消</button>
          <button type="submit" disabled={createMutation.isPending || updateMutation.isPending}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {isEdit ? '保存' : '创建'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
