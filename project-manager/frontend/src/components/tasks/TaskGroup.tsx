import { useState } from 'react';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, ChevronRight, ChevronDown, Pencil, Trash2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { TaskGroup as TaskGroupType, Task } from '../../types';
import { api } from '../../services/api';
import TaskItem from './TaskItem';
import TaskFormModal from './TaskFormModal';
import ConfirmDialog from '../common/ConfirmDialog';

interface Props {
  group: TaskGroupType;
  tasks: Task[];
  projectId: number;
}

export default function TaskGroup({ group, tasks, projectId }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(group.name);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const queryClient = useQueryClient();

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `group-${group.id}`,
    data: { type: 'group' },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const updateMutation = useMutation({
    mutationFn: () => api.updateTaskGroup(projectId, group.id, { name, sort_order: group.sort_order, metadata: group.metadata }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-groups', projectId] });
      toast.success('任务组已更新');
      setEditing(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteTaskGroup(projectId, group.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-groups', projectId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      toast.success('任务组已删除');
    },
  });

  const handleSaveName = () => {
    if (name.trim()) updateMutation.mutate();
  };

  return (
    <div ref={setNodeRef} style={style} className="mb-4">
      <div className="flex items-center gap-2 mb-2 px-1">
        <button {...attributes} {...listeners} className="text-gray-400 hover:text-gray-600 cursor-grab">
          <GripVertical size={16} />
        </button>
        <button onClick={() => setCollapsed(!collapsed)} className="text-gray-500">
          {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        </button>

        {editing ? (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleSaveName}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditing(false); }}
            className="flex-1 px-2 py-1 text-sm font-medium text-gray-900 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
        ) : (
          <>
            <h3 className="flex-1 text-sm font-semibold text-gray-700">{group.name}</h3>
            <span className="text-xs text-gray-400">{tasks.length}</span>
          </>
        )}

        <div className="flex items-center gap-1">
          {!editing && (
            <button onClick={() => { setName(group.name); setEditing(true); }} className="p-1 hover:bg-gray-100 rounded">
              <Pencil size={14} />
            </button>
          )}
          <button onClick={() => setShowAddTask(true)} className="p-1 hover:bg-blue-50 rounded text-blue-600">
            <Plus size={16} />
          </button>
          <button onClick={() => setShowDelete(true)} className="p-1 hover:bg-red-50 rounded text-red-500">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {!collapsed && (
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-1 ml-8">
            {tasks.map((task) => (
              <TaskItem key={task.id} task={task} projectId={projectId} />
            ))}
            {tasks.length === 0 && (
              <p className="text-sm text-gray-400 py-2">暂无任务，点击 + 添加</p>
            )}
          </div>
        </SortableContext>
      )}

      {showAddTask && <TaskFormModal projectId={projectId} taskId={null} groupId={group.id} onClose={() => setShowAddTask(false)} />}
      <ConfirmDialog
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={() => deleteMutation.mutate()}
        title="删除任务组"
        message={`确定删除任务组「${group.name}」吗？组内的任务将变为未分组。`}
        confirmLabel="删除"
        danger
      />
    </div>
  );
}
