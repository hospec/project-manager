import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, ChevronRight, ChevronDown, Pencil, Trash2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { TaskGroup } from '../../types';
import { api } from '../../services/api';
import ConfirmDialog from '../common/ConfirmDialog';

interface Props {
  group: TaskGroup | null;
  taskCount: number;
  collapsed: boolean;
  onToggle: () => void;
  projectId: number;
  colCount: number;
}

export default function TaskGroupHeader({ group, taskCount, collapsed, onToggle, projectId, colCount }: Props) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(group?.name ?? '未分组任务');
  const [showDelete, setShowDelete] = useState(false);
  const queryClient = useQueryClient();

  const sortableId = group ? `group-${group.id}` : 'group-ungrouped';
  const isUngrouped = group === null;

  const { attributes, listeners, setActivatorNodeRef, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sortableId,
    data: { type: 'group', groupId: group?.id ?? null },
    disabled: isUngrouped,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const updateMutation = useMutation({
    mutationFn: (newName: string) =>
      api.updateTaskGroup(projectId, group!.id, { name: newName, sort_order: group!.sort_order, metadata: group!.metadata }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-groups', projectId] });
      setEditing(false);
    },
    onError: () => toast.error('更新失败'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteTaskGroup(projectId, group!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-groups', projectId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      toast.success('任务组已删除');
    },
  });

  const handleSaveName = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== group?.name) {
      updateMutation.mutate(trimmed);
    } else {
      setEditing(false);
      setName(group?.name ?? '未分组任务');
    }
  };

  return (
    <>
      <div ref={setNodeRef} style={style} className="task-group-header">
        <div className="flex items-center gap-1.5">
          {!isUngrouped && (
            <button
              ref={setActivatorNodeRef}
              {...attributes}
              {...listeners}
              className="text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing p-0.5"
            >
              <GripVertical size={14} />
            </button>
          )}

          <button onClick={onToggle} className="text-gray-500 p-0.5 hover:bg-gray-200 rounded">
            {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
          </button>

          {editing && !isUngrouped ? (
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              onBlur={handleSaveName}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSaveName();
                if (e.key === 'Escape') { setEditing(false); setName(group?.name ?? ''); }
              }}
              className="px-2 py-0.5 text-sm font-semibold text-gray-900 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          ) : (
            <h3 className="text-sm font-semibold text-gray-700">
              {group?.name ?? '未分组任务'}
            </h3>
          )}

          <span className="text-xs text-gray-400">{taskCount}</span>

          {!isUngrouped && (
            <div className="flex items-center gap-0.5 ml-auto">
              {!editing && (
                <button
                  onClick={() => { setName(group?.name ?? ''); setEditing(true); }}
                  className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-gray-600"
                >
                  <Pencil size={13} />
                </button>
              )}
              <button
                onClick={() => setShowDelete(true)}
                className="p-1 hover:bg-red-50 rounded text-gray-400 hover:text-red-500"
              >
                <Trash2 size={13} />
              </button>
            </div>
          )}
        </div>
      </div>

      {!isUngrouped && (
        <ConfirmDialog
          open={showDelete}
          onClose={() => setShowDelete(false)}
          onConfirm={() => deleteMutation.mutate()}
          title="删除任务组"
          message={`确定删除任务组「${group?.name}」吗？组内的任务将变为未分组。`}
          confirmLabel="删除"
          danger
        />
      )}
    </>
  );
}
