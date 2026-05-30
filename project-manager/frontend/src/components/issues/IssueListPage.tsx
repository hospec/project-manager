import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { api } from '../../services/api';
import StatusBadge, { PriorityBadge } from '../common/StatusBadge';
import IssueFormModal from './IssueFormModal';
import ConfirmDialog from '../common/ConfirmDialog';
import EmptyState from '../common/EmptyState';

interface Props {
  projectId: number;
}

export default function IssueListPage({ projectId }: Props) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [filter, setFilter] = useState('');

  const { data: issues = [], isLoading, isError } = useQuery({
    queryKey: ['issues', projectId],
    queryFn: () => api.listIssues(projectId),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteIssue(projectId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issues', projectId] });
      toast.success('问题已删除');
    },
    onError: () => toast.error('删除失败'),
  });

  const filtered = filter ? issues.filter((i) => i.status === filter) : issues;

  if (isLoading) return <div className="text-gray-400 py-8 text-center">加载中...</div>;
  if (isError) return <div className="text-red-400 py-8 text-center">加载失败，请刷新重试</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">待办/问题清单</h2>
        <button onClick={() => { setEditingId(null); setShowForm(true); }}
          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <Plus size={16} /> 新建问题
        </button>
      </div>

      <div className="flex gap-2 mb-4">
        {['', 'open', 'in_progress', 'resolved', 'closed'].map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1 text-xs rounded-full border ${filter === s ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
            {s === '' ? '全部' : { open: '未处理', in_progress: '处理中', resolved: '已解决', closed: '已关闭' }[s]}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState title={filter ? '没有符合条件的问题' : '暂无问题'} description="记录项目中遇到的问题和待办事项" />
      ) : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-4 py-2 text-xs font-medium text-gray-500">标题</th>
                <th className="px-4 py-2 text-xs font-medium text-gray-500">状态</th>
                <th className="px-4 py-2 text-xs font-medium text-gray-500">优先级</th>
                <th className="px-4 py-2 text-xs font-medium text-gray-500">责任人</th>
                <th className="px-4 py-2 text-xs font-medium text-gray-500">截止日期</th>
                <th className="px-4 py-2 text-xs font-medium text-gray-500 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((issue) => (
                <tr key={issue.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm text-gray-900">{issue.title}</td>
                  <td className="px-4 py-2"><StatusBadge status={issue.status} /></td>
                  <td className="px-4 py-2"><PriorityBadge priority={issue.priority} /></td>
                  <td className="px-4 py-2 text-sm text-gray-500">{issue.assignee || '-'}</td>
                  <td className="px-4 py-2 text-sm text-gray-500">{issue.due_date || '-'}</td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1">
                      <button onClick={() => { setEditingId(issue.id); setShowForm(true); }} className="p-1 hover:bg-gray-200 rounded">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => setDeletingId(issue.id)} className="p-1 hover:bg-red-100 rounded text-red-500">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && <IssueFormModal projectId={projectId} issueId={editingId} onClose={() => { setShowForm(false); setEditingId(null); }} />}
      {deletingId !== null && (
        <ConfirmDialog
          open onClose={() => setDeletingId(null)}
          onConfirm={() => deleteMutation.mutate(deletingId)}
          title="删除问题" message="确定删除这个问题吗？" confirmLabel="删除" danger
        />
      )}
    </div>
  );
}
