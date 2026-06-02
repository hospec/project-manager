import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../../services/api';
import type { ProjectFormData } from '../../types';
import Modal from '../common/Modal';

interface Props {
  projectId: number | null;
  onClose: () => void;
  onCreated?: (id: number) => void;
}

export default function ProjectFormModal({ projectId, onClose, onCreated }: Props) {
  const queryClient = useQueryClient();
  const isEdit = projectId !== null;

  const { data: project } = useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => api.getProject(projectId!),
    enabled: isEdit,
  });

  const { data: phaseList = [] } = useQuery({
    queryKey: ['phases'],
    queryFn: api.listPhases,
    staleTime: 5 * 60 * 1000,
  });

  const defaultPhase = phaseList.length > 0 ? phaseList[0].phase_key : 'planning';

  const [form, setForm] = useState<ProjectFormData>({
    name: '', description: '', phase: defaultPhase, metadata: '{}',
  });

  useEffect(() => {
    if (project) {
      setForm({
        name: project.name,
        description: project.description,
        phase: project.phase,
        metadata: project.metadata,
      });
    }
  }, [project]);

  const createMutation = useMutation({
    mutationFn: () => api.createProject(form),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('项目已创建');
      onCreated?.(data.id);
    },
    onError: (err) => { console.error('createProject failed:', err); toast.error('创建失败: ' + (err instanceof Error ? err.message : String(err))); },
  });

  const updateMutation = useMutation({
    mutationFn: () => api.updateProject(projectId!, form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('项目已更新');
      onClose();
    },
    onError: (err) => { console.error('updateProject failed:', err); toast.error('更新失败: ' + (err instanceof Error ? err.message : String(err))); },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    if (isEdit) updateMutation.mutate();
    else createMutation.mutate();
  };

  return (
    <Modal open onClose={onClose} title={isEdit ? '编辑项目' : '新建项目'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">项目名称</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            placeholder="输入项目名称"
            autoFocus
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            rows={3}
            placeholder="项目描述（可选）"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">当前阶段</label>
          <select
            value={form.phase}
            onChange={(e) => setForm({ ...form, phase: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
          >
            {phaseList.map((p) => (
              <option key={p.id} value={p.phase_key}>{p.label}</option>
            ))}
          </select>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
            取消
          </button>
          <button
            type="submit"
            disabled={createMutation.isPending || updateMutation.isPending}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isEdit ? '保存' : '创建'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
