import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import { api } from '../../services/api';
import type { Task } from '../../types';
import TaskGroup from './TaskGroup';
import TaskItem from './TaskItem';
import TaskFormModal from './TaskFormModal';
import EmptyState from '../common/EmptyState';

interface Props {
  projectId: number;
}

export default function TaskListPage({ projectId }: Props) {
  const queryClient = useQueryClient();
  const [showAddTask, setShowAddTask] = useState(false);
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');

  const { data: groups = [], isLoading: groupsLoading } = useQuery({
    queryKey: ['task-groups', projectId],
    queryFn: () => api.listTaskGroups(projectId),
  });

  const { data: allTasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks', projectId],
    queryFn: () => api.listTasks(projectId),
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const reorderGroupsMutation = useMutation({
    mutationFn: (order: number[]) => api.reorderTaskGroups(projectId, order),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['task-groups', projectId] }),
  });

  const reorderTasksMutation = useMutation({
    mutationFn: ({ groupId, order }: { groupId: number; order: number[] }) => api.reorderTasks(projectId, groupId, order),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks', projectId] }),
    onError: () => { toast.error('排序失败'); queryClient.invalidateQueries({ queryKey: ['tasks', projectId] }); },
  });

  const moveTaskMutation = useMutation({
    mutationFn: ({ taskId, newGroupId }: { taskId: number; newGroupId: number | null }) =>
      api.updateTask(projectId, taskId, { group_id: newGroupId } as Partial<Task>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      toast.success('任务已移动');
    },
    onError: () => { toast.error('移动失败'); queryClient.invalidateQueries({ queryKey: ['tasks', projectId] }); },
  });

  const createGroupMutation = useMutation({
    mutationFn: (name: string) => api.createTaskGroup(projectId, { name, sort_order: 0, metadata: '{}' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-groups', projectId] });
      toast.success('任务组已创建');
      setShowAddGroup(false);
      setNewGroupName('');
    },
    onError: () => toast.error('创建失败'),
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    // Group reorder
    if (activeId.startsWith('group-') && overId.startsWith('group-')) {
      const oldIndex = groups.findIndex((g) => `group-${g.id}` === activeId);
      const newIndex = groups.findIndex((g) => `group-${g.id}` === overId);
      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove(groups, oldIndex, newIndex);
        // Optimistic update
        queryClient.setQueryData(['task-groups', projectId], reordered);
        reorderGroupsMutation.mutate(reordered.map((g) => g.id));
      }
      return;
    }

    // Task reorder within same group
    const activeTaskId = Number(activeId);
    const overTaskId = Number(overId);
    if (isNaN(activeTaskId) || isNaN(overTaskId)) return;

    const activeTask = allTasks.find((t) => t.id === activeTaskId);
    const overTask = allTasks.find((t) => t.id === overTaskId);
    if (!activeTask || !overTask) return;

    // Only reorder within same group
    if (activeTask.group_id === overTask.group_id) {
      const groupTasks = allTasks.filter((t) => t.group_id === activeTask.group_id);
      const oldIndex = groupTasks.findIndex((t) => t.id === activeTaskId);
      const newIndex = groupTasks.findIndex((t) => t.id === overTaskId);
      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove(groupTasks, oldIndex, newIndex);
        // Optimistic update
        const updated = allTasks.map((t) => {
          const idx = reordered.findIndex((r) => r.id === t.id);
          return idx !== -1 ? reordered[idx] : t;
        });
        queryClient.setQueryData(['tasks', projectId], updated);
        const gid = activeTask.group_id ?? 0;
        reorderTasksMutation.mutate({ groupId: gid, order: reordered.map((t) => t.id) });
      }
      return;
    }

    // Cross-group move: update task's group_id
    moveTaskMutation.mutate({ taskId: activeTaskId, newGroupId: overTask.group_id });
  };

  const ungroupedTasks = allTasks.filter((t) => !t.group_id);

  if (groupsLoading || tasksLoading) return <div className="text-gray-400 py-8 text-center">加载中...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">任务清单</h2>
        <div className="flex gap-2">
          {showAddGroup ? (
            <div className="flex gap-1">
              <input
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && newGroupName.trim()) createGroupMutation.mutate(newGroupName); if (e.key === 'Escape') setShowAddGroup(false); }}
                placeholder="组名"
                className="px-2 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 w-28"
                autoFocus
              />
              <button
                onClick={() => newGroupName.trim() && createGroupMutation.mutate(newGroupName)}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                确定
              </button>
            </div>
          ) : (
            <button onClick={() => setShowAddGroup(true)} className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
              <Plus size={16} /> 新建组
            </button>
          )}
          <button onClick={() => setShowAddTask(true)} className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Plus size={16} /> 新建任务
          </button>
        </div>
      </div>

      {groups.length === 0 && ungroupedTasks.length === 0 ? (
        <EmptyState title="暂无任务" description="创建你的第一个任务组和任务" action={{ label: '新建任务', onClick: () => setShowAddTask(true) }} />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={groups.map((g) => `group-${g.id}`)} strategy={verticalListSortingStrategy}>
            {groups.map((group) => (
              <TaskGroup
                key={group.id}
                group={group}
                tasks={allTasks.filter((t) => t.group_id === group.id)}
                projectId={projectId}
              />
            ))}
          </SortableContext>

          {ungroupedTasks.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-gray-500 mb-2 px-1">未分组任务</h3>
              <div className="space-y-1">
                {ungroupedTasks.map((task) => (
                  <TaskItem key={task.id} task={task} projectId={projectId} />
                ))}
              </div>
            </div>
          )}
        </DndContext>
      )}

      {showAddTask && <TaskFormModal projectId={projectId} taskId={null} onClose={() => setShowAddTask(false)} />}
    </div>
  );
}
