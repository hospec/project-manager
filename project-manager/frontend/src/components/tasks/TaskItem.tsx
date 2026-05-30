import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Task } from '../../types';
import { api } from '../../services/api';
import StatusBadge, { PriorityBadge } from '../common/StatusBadge';
import ConfirmDialog from '../common/ConfirmDialog';
import TaskFormModal from './TaskFormModal';

interface Props {
  task: Task;
  projectId: number;
}

export default function TaskItem({ task, projectId }: Props) {
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const queryClient = useQueryClient();

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteTask(projectId, task.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['overview', projectId] });
      toast.success('任务已删除');
    },
  });

  return (
    <>
      <div ref={setNodeRef} style={style} className="flex items-center gap-2 px-3 py-2 bg-white border rounded-lg hover:shadow-sm group">
        <button {...attributes} {...listeners} className="text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing">
          <GripVertical size={16} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium truncate ${task.status === 'done' ? 'line-through text-gray-400' : 'text-gray-900'}`}>
              {task.title}
            </span>
            <StatusBadge status={task.status} />
            <PriorityBadge priority={task.priority} />
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
            {task.assignee && <span>@{task.assignee}</span>}
            {task.planned_start_date && <span>{task.planned_start_date}</span>}
            {task.planned_end_date && <span>→ {task.planned_end_date}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => setShowEdit(true)} className="p-1 hover:bg-gray-100 rounded">
            <Pencil size={14} />
          </button>
          <button onClick={() => setShowDelete(true)} className="p-1 hover:bg-red-50 rounded text-red-500">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {showEdit && <TaskFormModal projectId={projectId} taskId={task.id} onClose={() => setShowEdit(false)} />}
      <ConfirmDialog
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={() => deleteMutation.mutate()}
        title="删除任务"
        message={`确定删除任务「${task.title}」吗？`}
        confirmLabel="删除"
        danger
      />
    </>
  );
}
