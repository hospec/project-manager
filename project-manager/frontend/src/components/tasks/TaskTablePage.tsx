import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  DndContext, rectIntersection, KeyboardSensor, PointerSensor, useSensor, useSensors,
  DragOverlay, type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import { api } from '../../services/api';
import type { Task } from '../../types';
import TaskTableHeader from './TaskTableHeader';
import TaskTableRow from './TaskTableRow';
import TaskGroupHeader from './TaskGroupHeader';
import DropTargetRow from './DropTargetRow';
import FilterBar, { defaultFilters, applyFilters } from './FilterBar';
import type { FilterState } from './FilterBar';
import EmptyState from '../common/EmptyState';

interface Props {
  projectId: number;
}

const DEFAULT_COL_WIDTHS: Record<string, number> = {
  '#': 40,
  title: 300,
  priority: 80,
  planned_start_date: 110,
  planned_end_date: 110,
  assignee: 100,
  status: 90,
  progress: 100,
};

const COL_KEYS = ['#', 'title', 'priority', 'planned_start_date', 'planned_end_date', 'assignee', 'status', 'progress'] as const;

export default function TaskTablePage({ projectId }: Props) {
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<string | number | null>(null);
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [addingInGroup, setAddingInGroup] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('task-table-columns');
      return saved ? { ...DEFAULT_COL_WIDTHS, ...JSON.parse(saved) } : { ...DEFAULT_COL_WIDTHS };
    } catch {
      return { ...DEFAULT_COL_WIDTHS };
    }
  });

  const { data: groups = [], isLoading: gLoading } = useQuery({
    queryKey: ['task-groups', projectId],
    queryFn: () => api.listTaskGroups(projectId),
    staleTime: 0,
  });

  const { data: allTasks = [], isLoading: tLoading } = useQuery({
    queryKey: ['tasks', projectId],
    queryFn: () => api.listTasks(projectId),
    staleTime: 0,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const reorderGroupsMu = useMutation({
    mutationFn: (order: number[]) => api.reorderTaskGroups(projectId, order),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['task-groups', projectId] }),
  });

  const reorderTasksMu = useMutation({
    mutationFn: ({ gid, order }: { gid: number; order: number[] }) =>
      api.reorderTasks(projectId, gid, order),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
    },
    onError: () => {
      toast.error('排序失败');
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
    },
  });

  const moveTaskMu = useMutation({
    mutationFn: ({ tid, group_id, after_task_id, before }: {
      tid: number;
      group_id: number | null;
      after_task_id?: number | null;
      before?: boolean;
    }) => api.moveTask(projectId, tid, { group_id, after_task_id, before }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks', projectId] }),
    onError: () => {
      toast.error('移动失败');
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
    },
  });

  const createGroupMu = useMutation({
    mutationFn: (name: string) => api.createTaskGroup(projectId, { name, sort_order: 0, metadata: '{}' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-groups', projectId] });
      toast.success('任务组已创建');
      setShowAddGroup(false);
      setNewGroupName('');
    },
    onError: () => toast.error('创建失败'),
  });

  const createTaskMu = useMutation({
    mutationFn: ({ title, group_id }: { title: string; group_id: number | null }) =>
      api.createTask(projectId, {
        title,
        group_id,
        description: '',
        assignee: '',
        status: 'todo',
        priority: 'medium',
        planned_start_date: '',
        planned_end_date: '',
        actual_start_date: '',
        actual_end_date: '',
        sort_order: 0,
        progress: '',
        risk: '',
        metadata: '{}',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['overview', projectId] });
      toast.success('任务已创建');
      setAddingInGroup(null);
    },
    onError: () => toast.error('创建失败'),
  });

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;

    const activeType = active.data.current?.type;
    const overType = over.data.current?.type;

    // Group reorder
    if (activeType === 'group' && overType === 'group') {
      const oldIdx = groups.findIndex(g => `group-${g.id}` === String(active.id));
      const newIdx = groups.findIndex(g => `group-${g.id}` === String(over.id));
      if (oldIdx !== -1 && newIdx !== -1) {
        const reordered = arrayMove(groups, oldIdx, newIdx);
        queryClient.setQueryData(['task-groups', projectId], reordered);
        reorderGroupsMu.mutate(reordered.map(g => g.id));
      }
      return;
    }

    // Task drag/reorder
    if (activeType !== 'task') return;

    const activeTaskId = Number(active.id);
    const activeTask = allTasks.find(t => t.id === activeTaskId);
    if (!activeTask) return;

    // Drop on drop-zone (empty area)
    if (overType === 'drop-zone') {
      const targetGroupId = over.data.current?.group_id;
      if (activeTask.group_id === targetGroupId || (activeTask.group_id == null && targetGroupId == null)) return;
      const updated = allTasks.map(t =>
        t.id === activeTaskId ? { ...t, group_id: targetGroupId, sort_order: 999999 } : t
      );
      queryClient.setQueryData(['tasks', projectId], updated);
      moveTaskMu.mutate({ tid: activeTaskId, group_id: targetGroupId });
      toast.success('任务已移动');
      return;
    }

    // Drop on another task
    if (overType === 'task') {
      const overTaskId = Number(over.id);
      const overTask = allTasks.find(t => t.id === overTaskId);
      if (!overTask) return;

      if (activeTask.group_id === overTask.group_id) {
        // Same-group reorder
        const groupTasks = allTasks.filter(t => t.group_id === activeTask.group_id);
        const oldIdx = groupTasks.findIndex(t => t.id === activeTaskId);
        const newIdx = groupTasks.findIndex(t => t.id === overTaskId);
        if (oldIdx !== -1 && newIdx !== -1) {
          const reordered = arrayMove(groupTasks, oldIdx, newIdx);
          const updated = allTasks.map(t => {
            const idx = reordered.findIndex(r => r.id === t.id);
            return idx !== -1 ? reordered[idx] : t;
          });
          queryClient.setQueryData(['tasks', projectId], updated);
          reorderTasksMu.mutate({ gid: activeTask.group_id ?? 0, order: reordered.map(t => t.id) });
        }
      } else {
        // Cross-group move
        const targetGroupId = overTask.group_id;
        const updated = allTasks.map(t =>
          t.id === activeTaskId ? { ...t, group_id: targetGroupId, sort_order: (overTask.sort_order ?? 0) - 500 } : t
        );
        queryClient.setQueryData(['tasks', projectId], updated);
        moveTaskMu.mutate({
          tid: activeTaskId,
          group_id: targetGroupId,
          after_task_id: overTaskId,
          before: true,
        });
        toast.success('任务已移动');
      }
    }
  }, [groups, allTasks, projectId, queryClient, reorderGroupsMu, reorderTasksMu, moveTaskMu]);

  // Build task map by group, apply filters
  const tasksByGroup = useMemo(() => {
    const map = new Map<number | null, Task[]>();
    for (const t of allTasks) {
      const key = t.group_id ?? null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return map;
  }, [allTasks]);

  const filteredTasksByGroup = useMemo(() => {
    const map = new Map<number | null, Task[]>();
    for (const [key, tasks] of tasksByGroup) {
      map.set(key, applyFilters(tasks, filters));
    }
    return map;
  }, [tasksByGroup, filters]);

  const ungroupedTasks = filteredTasksByGroup.get(null) || [];
  const activeTask = activeId != null ? allTasks.find(t => t.id === Number(activeId)) : null;

  if (gLoading || tLoading) return <div className="text-gray-400 py-8 text-center">加载中...</div>;

  const isEmpty = groups.length === 0 && ungroupedTasks.length === 0;

  const handleColResize = (key: string, width: number) => {
    const next = { ...colWidths, [key]: Math.max(40, width) };
    setColWidths(next);
    localStorage.setItem('task-table-columns', JSON.stringify(next));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-bold text-gray-900">任务清单</h2>
        <div className="flex gap-2">
          {showAddGroup ? (
            <div className="flex gap-1">
              <input
                value={newGroupName}
                onChange={e => setNewGroupName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && newGroupName.trim()) createGroupMu.mutate(newGroupName);
                  if (e.key === 'Escape') { setShowAddGroup(false); setNewGroupName(''); }
                }}
                placeholder="组名"
                className="px-2 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 w-28"
                autoFocus
              />
              <button
                onClick={() => newGroupName.trim() && createGroupMu.mutate(newGroupName)}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                确定
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAddGroup(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Plus size={16} /> 新建组
            </button>
          )}
        </div>
      </div>

      {/* Filter bar */}
      <FilterBar filters={filters} onChange={setFilters} />

      {isEmpty ? (
        <EmptyState
          title="暂无任务"
          description="创建你的第一个任务组和任务"
          action={{ label: '新建任务组', onClick: () => setShowAddGroup(true) }}
        />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={rectIntersection}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="task-table">
            <TaskTableHeader colWidths={colWidths} onResize={handleColResize} />

            {/* Group sort context */}
            <SortableContext items={groups.map(g => `group-${g.id}`)} strategy={verticalListSortingStrategy}>
              {groups.map(group => {
                const tasks = filteredTasksByGroup.get(group.id) || [];
                const gKey = `g-${group.id}`;
                const collapsed = collapsedGroups.has(gKey);
                const isAdding = addingInGroup === gKey;
                return (
                  <div key={gKey}>
                    <TaskGroupHeader
                      group={group}
                      taskCount={tasks.length}
                      collapsed={collapsed}
                      onToggle={() => setCollapsedGroups(prev => {
                        const next = new Set(prev);
                        collapsed ? next.delete(gKey) : next.add(gKey);
                        return next;
                      })}
                      projectId={projectId}
                      colCount={COL_KEYS.length}
                    />
                    {!collapsed && (
                      <>
                        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                          {tasks.map((task, idx) => (
                            <TaskTableRow
                              key={task.id}
                              task={task}
                              projectId={projectId}
                              rowNumber={idx + 1}
                              colWidths={colWidths}
                            />
                          ))}
                        </SortableContext>
                        {/* Add task row */}
                        {isAdding ? (
                          <div className="task-table-row">
                            <div className="task-table-cell" style={{ width: colWidths['#'], minWidth: colWidths['#'], flex: 'none', justifyContent: 'center' }}>
                              <span className="text-gray-300 text-sm">+</span>
                            </div>
                            <div className="task-table-cell" style={{ width: colWidths.title || 300, flex: 'none', padding: '2px 6px' }}>
                              <input
                                autoFocus
                                placeholder="输入任务名，按 Enter 创建..."
                                className="w-full px-2 py-1 text-sm text-gray-900 placeholder:text-gray-400 border border-blue-300 rounded focus:outline-none focus:border-blue-500"
                                onKeyDown={e => {
                                  if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) {
                                    createTaskMu.mutate({
                                      title: (e.target as HTMLInputElement).value.trim(),
                                      group_id: group.id,
                                    });
                                  }
                                  if (e.key === 'Escape') setAddingInGroup(null);
                                }}
                                onBlur={() => setAddingInGroup(null)}
                              />
                            </div>
                          </div>
                        ) : (
                          <div
                            className="task-table-row cursor-pointer hover:bg-blue-50/30"
                            onClick={() => setAddingInGroup(gKey)}
                          >
                            <div className="task-table-cell" style={{ width: colWidths['#'], minWidth: colWidths['#'], flex: 'none', justifyContent: 'center' }}>
                              <span className="text-gray-300 text-sm">+</span>
                            </div>
                            <div className="task-table-cell" style={{ width: colWidths.title || 300, flex: 'none' }}>
                              <span className="text-sm text-gray-400 hover:text-blue-600">+ 添加任务...</span>
                            </div>
                          </div>
                        )}
                        <DropTargetRow groupId={group.id} colCount={COL_KEYS.length} />
                      </>
                    )}
                  </div>
                );
              })}
            </SortableContext>

            {/* Ungrouped tasks */}
            <div>
              <TaskGroupHeader
                group={null}
                taskCount={ungroupedTasks.length}
                collapsed={collapsedGroups.has('g-ungrouped')}
                onToggle={() => setCollapsedGroups(prev => {
                  const next = new Set(prev);
                  next.has('g-ungrouped') ? next.delete('g-ungrouped') : next.add('g-ungrouped');
                  return next;
                })}
                projectId={projectId}
                colCount={COL_KEYS.length}
              />
              {!collapsedGroups.has('g-ungrouped') && (
                <>
                  <SortableContext items={ungroupedTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                    {ungroupedTasks.map((task, idx) => (
                      <TaskTableRow
                        key={task.id}
                        task={task}
                        projectId={projectId}
                        rowNumber={idx + 1}
                        colWidths={colWidths}
                      />
                    ))}
                  </SortableContext>
                  {addingInGroup === 'g-ungrouped' ? (
                    <div className="task-table-row">
                      <div className="task-table-cell" style={{ width: colWidths['#'], minWidth: colWidths['#'], flex: 'none', justifyContent: 'center' }}>
                        <span className="text-gray-300 text-sm">+</span>
                      </div>
                      <div className="task-table-cell" style={{ width: colWidths.title || 300, flex: 'none', padding: '2px 6px' }}>
                        <input
                          autoFocus
                          placeholder="输入任务名，按 Enter 创建..."
                          className="w-full px-2 py-1 text-sm text-gray-900 placeholder:text-gray-400 border border-blue-300 rounded focus:outline-none focus:border-blue-500"
                          onKeyDown={e => {
                            if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) {
                              createTaskMu.mutate({
                                title: (e.target as HTMLInputElement).value.trim(),
                                group_id: null,
                              });
                            }
                            if (e.key === 'Escape') setAddingInGroup(null);
                          }}
                          onBlur={() => setAddingInGroup(null)}
                        />
                      </div>
                    </div>
                  ) : (
                    <div
                      className="task-table-row cursor-pointer hover:bg-blue-50/30"
                      onClick={() => setAddingInGroup('g-ungrouped')}
                    >
                      <div className="task-table-cell" style={{ width: colWidths['#'], minWidth: colWidths['#'], flex: 'none', justifyContent: 'center' }}>
                        <span className="text-gray-300 text-sm">+</span>
                      </div>
                      <div className="task-table-cell" style={{ width: colWidths.title || 300, flex: 'none' }}>
                        <span className="text-sm text-gray-400 hover:text-blue-600">+ 添加任务...</span>
                      </div>
                    </div>
                  )}
                  <DropTargetRow groupId={null} colCount={COL_KEYS.length} />
                </>
              )}
            </div>
          </div>

          <DragOverlay>
            {activeTask && (
              <div className="bg-white border border-blue-400 shadow-lg rounded px-3 py-1.5 opacity-90">
                <span className="text-sm font-medium text-gray-900">{activeTask.title}</span>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
