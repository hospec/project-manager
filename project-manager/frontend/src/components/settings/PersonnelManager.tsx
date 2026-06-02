import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { api } from '../../services/api';
import type { Personnel } from '../../types';
import ConfirmDialog from '../common/ConfirmDialog';

interface PersonModalProps {
  person?: Personnel | null;
  onClose: () => void;
}

function PersonModal({ person, onClose }: PersonModalProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(person?.name || '');
  const [title, setTitle] = useState(person?.title || '');
  const [resp, setResp] = useState(person?.responsibilities || '');

  const createMutation = useMutation({
    mutationFn: () => api.createPersonnel({ name, title, responsibilities: resp }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personnel'] });
      toast.success('人员已添加');
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: () => api.updatePersonnel(person!.id, { name, title, responsibilities: resp }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personnel'] });
      toast.success('人员已更新');
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSubmit = () => {
    if (!name.trim()) { toast.error('姓名不能为空'); return; }
    if (person) updateMutation.mutate();
    else createMutation.mutate();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg p-6 w-96 shadow-xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {person ? '编辑人员' : '新增人员'}
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">姓名 *</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">职位</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">负责内容</label>
            <textarea value={resp} onChange={e => setResp(e.target.value)} rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">取消</button>
          <button onClick={handleSubmit}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >{person ? '保存' : '添加'}</button>
        </div>
      </div>
    </div>
  );
}

export default function PersonnelManager() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Personnel | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Personnel | null>(null);

  const { data: personnel = [], isLoading } = useQuery({
    queryKey: ['personnel'],
    queryFn: api.listPersonnel,
    staleTime: 5 * 60 * 1000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deletePersonnel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personnel'] });
      toast.success('人员已删除');
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="text-gray-500 text-sm">加载中...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">管理项目成员，在任务和待办中可下拉选择。</p>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        ><Plus size={14} /> 新增人员</button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">姓名</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">职位</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">负责内容</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase w-20">操作</th>
            </tr>
          </thead>
          <tbody>
            {personnel.map(p => (
              <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{p.name}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{p.title}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{p.responsibilities}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => setEditing(p)} className="p-1 text-gray-400 hover:text-blue-600"><Pencil size={14} /></button>
                  <button onClick={() => setDeleteTarget(p)} className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
            {personnel.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-sm text-gray-400 text-center">暂无人员，请添加</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {(showAdd || editing) && (
        <PersonModal person={editing} onClose={() => { setShowAdd(false); setEditing(null); }} />
      )}

      {deleteTarget && (
        <ConfirmDialog
          open
          onClose={() => setDeleteTarget(null)}
          title="删除人员"
          message={`确定删除「${deleteTarget.name}」吗？已分配给此人的任务不会自动取消分配。`}
          onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
        />
      )}
    </div>
  );
}
