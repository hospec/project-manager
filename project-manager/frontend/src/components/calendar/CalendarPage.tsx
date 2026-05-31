import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../../services/api';
import type { CalendarTask, TaskFormData } from '../../types';
import TaskDailyCell from './TaskDailyCell';

interface Props {
  projectId: number;
}

const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  todo: { label: '待办', cls: 'bg-gray-100 text-gray-600' },
  in_progress: { label: '进行中', cls: 'bg-blue-100 text-blue-700' },
  done: { label: '已完成', cls: 'bg-green-100 text-green-700' },
  blocked: { label: '阻塞', cls: 'bg-red-100 text-red-700' },
};

function getWeeksInMonth(year: number, month: number): { start: Date; end: Date }[] {
  const weeks: { start: Date; end: Date }[] = [];
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const start = new Date(firstDay);
  const dayOfWeek = start.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  start.setDate(start.getDate() + mondayOffset);
  while (start <= lastDay) {
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    weeks.push({ start: new Date(start), end: new Date(end) });
    start.setDate(start.getDate() + 7);
  }
  return weeks;
}

function formatDate(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function toDateStr(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function weekDays(week: { start: Date; end: Date }): Date[] {
  const days: Date[] = [];
  const d = new Date(week.start);
  while (d <= week.end) {
    days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

const CELL_TEXTAREA_CLS =
  'w-full resize-none text-xs text-gray-900 placeholder:text-gray-300 ' +
  'rounded px-1.5 py-1 border border-dashed border-gray-200 ' +
  'hover:border-gray-300 focus:border-blue-400 focus:bg-blue-50/30 ' +
  'focus:outline-none focus:ring-1 focus:ring-blue-300 ' +
  'transition-colors';

function autoGrow(el: HTMLTextAreaElement) {
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

/** Controlled textarea that auto-grows on mount and on value change */
function AutoTextarea({ value, onChange, onSave, className }: {
  value: string;
  onChange?: (v: string) => void;
  onSave: (v: string) => void;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [local, setLocal] = useState(value);
  const prevValueRef = useRef(value);

  // Sync from parent when value prop changes (e.g. after query refetch)
  useEffect(() => {
    if (value !== prevValueRef.current) {
      setLocal(value);
      prevValueRef.current = value;
    }
  }, [value]);

  // Auto-grow on mount and when local value changes
  useEffect(() => {
    if (ref.current) autoGrow(ref.current);
  }, [local]);

  const handleBlur = () => {
    if (local !== value) {
      onSave(local);
      prevValueRef.current = local;
    }
  };

  return (
    <textarea
      ref={ref}
      value={local}
      onChange={(e) => { setLocal(e.target.value); onChange?.(e.target.value); }}
      onBlur={handleBlur}
      rows={1}
      className={className ?? CELL_TEXTAREA_CLS}
      style={{ minHeight: '28px' }}
      onFocus={(e) => autoGrow(e.target)}
    />
  );
}

export default function CalendarPage({ projectId }: Props) {
  const queryClient = useQueryClient();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
  const weeks = useMemo(() => getWeeksInMonth(year, month), [year, month]);

  const { data: calData, isLoading, isError } = useQuery({
    queryKey: ['calendar', projectId, monthStr],
    queryFn: () => api.getCalendar(projectId, monthStr),
  });

  const tasks: CalendarTask[] = calData?.tasks ?? [];

  const updateTaskMutation = useMutation({
    mutationFn: ({ taskId, data }: { taskId: number; data: Partial<TaskFormData> }) =>
      api.updateTask(projectId, taskId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar', projectId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
    },
    onError: () => toast.error('保存失败'),
  });

  const goToday = useCallback(() => {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
  }, [today]);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const tasksForWeek = (week: { start: Date; end: Date }) => {
    const ws = toDateStr(week.start);
    const we = toDateStr(week.end);
    return tasks.filter(t => t.planned_start_date <= we && t.planned_end_date >= ws);
  };

  if (isLoading) return <div className="text-gray-400 py-8 text-center">加载中...</div>;
  if (isError) return <div className="text-red-400 py-8 text-center">加载失败，请刷新重试</div>;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">日程表</h2>
        <div className="flex items-center gap-2 text-gray-700">
          <button onClick={prevMonth} className="p-1 hover:bg-gray-100 rounded"><ChevronLeft size={20} /></button>
          <span className="text-lg font-semibold min-w-[120px] text-center text-gray-900">{year}年{month + 1}月</span>
          <button onClick={nextMonth} className="p-1 hover:bg-gray-100 rounded"><ChevronRight size={20} /></button>
          <button onClick={goToday} className="ml-2 px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700">今天</button>
        </div>
      </div>

      <div className="space-y-6">
        {weeks.map((week, wi) => {
          const weekTasks = tasksForWeek(week);
          const days = weekDays(week);

          return (
            <div key={wi} className="bg-white rounded-lg border overflow-hidden">
              <div className="bg-gray-50 px-3 py-2 text-sm font-medium text-gray-600 border-b">
                第{wi + 1}周 ({formatDate(week.start)} - {formatDate(week.end)})
              </div>

              <div className="overflow-x-auto">
                <table className="w-full table-fixed">
                  <thead>
                    <tr className="border-b bg-gray-50/50">
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 w-[140px]">任务</th>
                      {days.map((d, i) => (
                        <th key={i} className="px-1 py-2 text-center text-xs font-medium text-gray-500">
                          <div>{WEEKDAYS[i]}</div>
                          <div className="text-[10px]">{d.getMonth() + 1}/{d.getDate()}</div>
                        </th>
                      ))}
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 w-[150px]">进展情况</th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 w-[130px]">风险</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weekTasks.length > 0 ? weekTasks.map(task => {
                      const badge = STATUS_BADGE[task.status] ?? STATUS_BADGE.todo;
                      return (
                        <tr key={task.id} className="border-b hover:bg-gray-50/30">
                          <td className="px-2 py-2 align-top">
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className="text-sm font-medium text-gray-900 leading-tight">{task.title}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${badge.cls}`}>{badge.label}</span>
                            </div>
                            {task.assignee && (
                              <div className="text-xs text-gray-400 mt-0.5">@{task.assignee}</div>
                            )}
                          </td>

                          {days.map(d => {
                            const dateStr = toDateStr(d);
                            const inRange = task.planned_start_date <= dateStr && task.planned_end_date >= dateStr;
                            return (
                              <td key={dateStr} className={`px-0.5 py-0.5 align-top border-l ${inRange ? 'bg-white' : 'bg-gray-100/40'}`}>
                                {inRange && (
                                  <TaskDailyCell
                                    projectId={projectId}
                                    taskId={task.id}
                                    date={dateStr}
                                    initialContent={task.daily_notes?.[dateStr] ?? ''}
                                  />
                                )}
                              </td>
                            );
                          })}

                          <td className="px-1 py-0.5 align-top border-l">
                            <AutoTextarea
                              value={task.progress ?? ''}
                              onSave={(v) => updateTaskMutation.mutate({
                                taskId: task.id,
                                data: { progress: v } as Partial<TaskFormData>,
                              })}
                            />
                          </td>

                          <td className="px-1 py-0.5 align-top border-l">
                            <AutoTextarea
                              value={task.risk ?? ''}
                              onSave={(v) => updateTaskMutation.mutate({
                                taskId: task.id,
                                data: { risk: v } as Partial<TaskFormData>,
                              })}
                            />
                          </td>
                        </tr>
                      );
                    }) : (
                      <tr>
                        <td colSpan={10} className="px-4 py-8 text-center text-sm text-gray-400">
                          本周暂无任务安排
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
