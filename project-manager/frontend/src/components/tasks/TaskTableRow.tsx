import { useState, useCallback, useRef, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Task } from '../../types';
import { api } from '../../services/api';
import { PriorityBadge } from '../common/StatusBadge';
import ConfirmDialog from '../common/ConfirmDialog';

interface Props {
  task: Task;
  projectId: number;
  rowNumber: number;
  colWidths: Record<string, number>;
}

const PRIORITY_OPTIONS = [
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
  { value: 'critical', label: '紧急' },
] as const;

const STATUS_OPTIONS = [
  { value: 'todo', label: '待办' },
  { value: 'in_progress', label: '进行中' },
  { value: 'done', label: '已完成' },
  { value: 'blocked', label: '阻塞' },
] as const;

type ColKey = 'title' | 'priority' | 'planned_start_date' | 'planned_end_date' | 'assignee' | 'status' | 'progress';

export default function TaskTableRow({ task, projectId, rowNumber, colWidths }: Props) {
  const queryClient = useQueryClient();
  const [editingCol, setEditingCol] = useState<ColKey | null>(null);
  const [editValue, setEditValue] = useState('');
  const [savedCol, setSavedCol] = useState<ColKey | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { attributes, listeners, setActivatorNodeRef, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: 'task', group_id: task.group_id },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const saveMutation = useMutation({
    mutationFn: (data: Partial<Task>) => api.updateTask(projectId, task.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['overview', projectId] });
    },
    onError: () => {
      toast.error('保存失败');
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteTask(projectId, task.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['overview', projectId] });
      toast.success('任务已删除');
    },
  });

  const startEdit = useCallback((col: ColKey, currentValue: string) => {
    setEditingCol(col);
    setEditValue(currentValue);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingCol(null);
    setEditValue('');
  }, []);

  const saveEdit = useCallback(() => {
    if (!editingCol) return;
    const currentVal = String(task[editingCol as keyof Task] ?? '');
    if (editValue === currentVal) {
      setEditingCol(null);
      return;
    }
    saveMutation.mutate({ [editingCol]: editValue } as Partial<Task>);
    setEditingCol(null);
    setSavedCol(editingCol);
    setTimeout(() => setSavedCol(null), 800);
  }, [editingCol, editValue, task, saveMutation]);

  useEffect(() => {
    if (!editingCol) return;
    if (editingCol === 'progress' && textareaRef.current) {
      textareaRef.current.focus();
      // Auto-resize on initial render
      const el = textareaRef.current;
      el.style.height = 'auto';
      el.style.height = el.scrollHeight + 'px';
    } else if (inputRef.current) {
      inputRef.current.focus();
      if (inputRef.current instanceof HTMLInputElement) {
        inputRef.current.select();
      }
    }
  }, [editingCol]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (editingCol === 'progress') {
      // In progress textarea: Shift+Enter to save, Enter for newline
      if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault();
        saveEdit();
      }
      // Plain Enter passes through (newline in textarea)
      if (e.key === 'Escape') {
        cancelEdit();
      }
    } else {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveEdit();
      } else if (e.key === 'Escape') {
        cancelEdit();
      }
    }
  };

  const renderCell = (col: ColKey, display: React.ReactNode, editElement?: React.ReactNode) => {
    const isEditing = editingCol === col;
    const isSaved = savedCol === col;

    if (isEditing && editElement) {
      return editElement;
    }

    const cellClass = [
      'task-table-cell',
      isSaved ? 'cell-saved' : '',
      'cursor-pointer hover:bg-gray-50/50',
    ].filter(Boolean).join(' ');

    return (
      <div
        className={cellClass}
        style={{ width: colWidths[col] || 100, minWidth: colWidths[col] || 100, flex: 'none' }}
        onClick={() => {
          startEdit(col, String(task[col] ?? ''));
        }}
      >
        {display}
      </div>
    );
  };

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={`task-table-row group hover:bg-gray-50/30 ${isDragging ? 'dragging' : ''}`}
      >
        {/* # column - drag handle */}
        <div className="task-table-cell" style={{ width: colWidths['#'] || 40, minWidth: colWidths['#'] || 40, flex: 'none', justifyContent: 'center' }}>
          <button
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            className="text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing p-0.5"
          >
            <GripVertical size={14} />
          </button>
        </div>

        {/* Title */}
        {editingCol === 'title' ? (
          <div className="task-table-cell cell-editing" style={{ width: colWidths.title || 300, flex: 'none', padding: '2px 6px' }}>
            <input
              ref={inputRef as React.Ref<HTMLInputElement>}
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onBlur={saveEdit}
              onKeyDown={handleKeyDown}
              className="w-full px-1 py-0.5 text-sm text-gray-900 border-0 focus:outline-none bg-transparent"
            />
          </div>
        ) : (
          <div
            className="task-table-cell cursor-pointer hover:bg-gray-50/50"
            style={{ width: colWidths.title || 300, flex: 'none' }}
            onClick={() => startEdit('title', task.title)}
          >
            <span className={`text-sm truncate ${task.status === 'done' ? 'line-through text-gray-400' : 'text-gray-900'}`}>
              {task.title}
            </span>
          </div>
        )}

        {/* Priority */}
        {renderCell('priority',
          <PriorityBadge priority={task.priority} />,
          editingCol === 'priority' ? (
            <div className="task-table-cell cell-editing" style={{ width: colWidths.priority || 80, flex: 'none', padding: '2px 6px' }}>
              <select
                ref={inputRef as React.Ref<HTMLSelectElement>}
                value={editValue}
                onChange={e => {
                  saveMutation.mutate({ priority: e.target.value } as Partial<Task>);
                  setEditingCol(null);
                }}
                onBlur={saveEdit}
                onKeyDown={handleKeyDown}
                className="w-full text-xs text-gray-900 border-0 focus:outline-none bg-transparent py-0.5"
              >
                {PRIORITY_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          ) : undefined
        )}

        {/* Planned Start */}
        {renderCell('planned_start_date',
          <span className="text-gray-600 text-sm">{task.planned_start_date || '-'}</span>,
          editingCol === 'planned_start_date' ? (
            <div className="task-table-cell cell-editing" style={{ width: colWidths.planned_start_date || 110, flex: 'none', padding: '2px 6px' }}>
              <input
                ref={inputRef as React.Ref<HTMLInputElement>}
                type="date"
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onBlur={saveEdit}
                onKeyDown={handleKeyDown}
                className="w-full text-xs text-gray-900 border-0 focus:outline-none bg-transparent"
              />
            </div>
          ) : undefined
        )}

        {/* Planned End */}
        {renderCell('planned_end_date',
          <span className="text-gray-600 text-sm">{task.planned_end_date || '-'}</span>,
          editingCol === 'planned_end_date' ? (
            <div className="task-table-cell cell-editing" style={{ width: colWidths.planned_end_date || 110, flex: 'none', padding: '2px 6px' }}>
              <input
                ref={inputRef as React.Ref<HTMLInputElement>}
                type="date"
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onBlur={saveEdit}
                onKeyDown={handleKeyDown}
                className="w-full text-xs text-gray-900 border-0 focus:outline-none bg-transparent"
              />
            </div>
          ) : undefined
        )}

        {/* Assignee */}
        {renderCell('assignee',
          <span className={task.assignee ? 'text-gray-700 text-sm' : 'text-gray-400 text-sm'}>
            {task.assignee || '-'}
          </span>,
          editingCol === 'assignee' ? (
            <div className="task-table-cell cell-editing" style={{ width: colWidths.assignee || 100, flex: 'none', padding: '2px 6px' }}>
              <input
                ref={inputRef as React.Ref<HTMLInputElement>}
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onBlur={saveEdit}
                onKeyDown={handleKeyDown}
                placeholder="负责人"
                className="w-full text-xs text-gray-900 placeholder:text-gray-400 border-0 focus:outline-none bg-transparent"
              />
            </div>
          ) : undefined
        )}

        {/* Status */}
        {renderCell('status',
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${
            task.status === 'todo' ? 'bg-gray-100 text-gray-600' :
            task.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
            task.status === 'done' ? 'bg-green-100 text-green-700' :
            'bg-red-100 text-red-700'
          }`}>
            {task.status === 'todo' ? '待办' :
             task.status === 'in_progress' ? '进行中' :
             task.status === 'done' ? '已完成' : '阻塞'}
          </span>,
          editingCol === 'status' ? (
            <div className="task-table-cell cell-editing" style={{ width: colWidths.status || 90, flex: 'none', padding: '2px 6px' }}>
              <select
                ref={inputRef as React.Ref<HTMLSelectElement>}
                value={editValue}
                onChange={e => {
                  saveMutation.mutate({ status: e.target.value } as Partial<Task>);
                  setEditingCol(null);
                }}
                onBlur={saveEdit}
                onKeyDown={handleKeyDown}
                className="w-full text-xs text-gray-900 border-0 focus:outline-none bg-transparent py-0.5"
              >
                {STATUS_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          ) : undefined
        )}

        {/* Progress — uses textarea for multiline support, auto-resizes */}
        {editingCol === 'progress' ? (
          <div className="task-table-cell cell-editing" style={{ width: colWidths.progress || 100, flex: 'none', padding: '2px 6px', minHeight: 48, alignSelf: 'stretch' }}>
            <textarea
              ref={textareaRef}
              value={editValue}
              onChange={e => {
                setEditValue(e.target.value);
                // Auto-resize: reset height then grow to fit content
                const el = e.target;
                el.style.height = 'auto';
                el.style.height = el.scrollHeight + 'px';
              }}
              onBlur={saveEdit}
              onKeyDown={handleKeyDown}
              placeholder="如 60%&#10;或简短描述"
              className="w-full text-xs text-gray-900 placeholder:text-gray-400 border-0 focus:outline-none bg-transparent resize-none"
            />
          </div>
        ) : (
          <div
            className={`task-table-cell cursor-pointer hover:bg-gray-50/50 ${savedCol === 'progress' ? 'cell-saved' : ''}`}
            style={{ width: colWidths.progress || 100, flex: 'none' }}
            onClick={() => startEdit('progress', task.progress || '')}
          >
            <span className={`text-sm whitespace-pre-wrap ${task.progress ? 'text-gray-700' : 'text-gray-400'}`}>
              {task.progress || '-'}
            </span>
          </div>
        )}

        {/* Delete button */}
        <div className="task-table-cell" style={{ width: 36, minWidth: 36, flex: 'none', justifyContent: 'center', padding: 2 }}>
          <button
            onClick={() => setShowDelete(true)}
            className="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-50 rounded text-red-400 hover:text-red-600 transition-opacity"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

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
