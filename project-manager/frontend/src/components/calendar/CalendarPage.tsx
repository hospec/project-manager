import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventClickArg, EventDropArg, EventChangeArg, DatesSetArg } from '@fullcalendar/core';
import { api } from '../../services/api';
import type { Task, TaskFormData } from '../../types';
import CompletionModal from './CompletionModal';

interface Props {
  projectId: number;
}

export default function CalendarPage({ projectId }: Props) {
  const queryClient = useQueryClient();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: new Date().toISOString().slice(0, 7) + '-01',
    end: new Date().toISOString().slice(0, 7) + '-31',
  });

  const { data: events = [], isLoading, isError } = useQuery({
    queryKey: ['calendar', projectId, dateRange.start, dateRange.end],
    queryFn: () => api.getCalendarEvents(projectId, dateRange.start, dateRange.end),
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ taskId, data }: { taskId: number; data: Partial<TaskFormData> }) =>
      api.updateTask(projectId, taskId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar', projectId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      toast.success('日期已更新');
    },
    onError: () => {
      toast.error('更新失败');
      queryClient.invalidateQueries({ queryKey: ['calendar', projectId] });
    },
  });

  const handleDatesSet = useCallback((arg: DatesSetArg) => {
    setDateRange({
      start: arg.start.toISOString().slice(0, 10),
      end: arg.end.toISOString().slice(0, 10),
    });
  }, []);

  const handleEventClick = useCallback((arg: EventClickArg) => {
    const e = events.find((evt) => evt.id === Number(arg.event.id));
    if (e) {
      const { completion_records, ...task } = e;
      setSelectedTask(task);
      setSelectedDate(arg.event.start?.toISOString().slice(0, 10) || '');
    }
  }, [events]);

  const handleEventDrop = useCallback((arg: EventDropArg) => {
    const taskId = Number(arg.event.id);
    const newStart = arg.event.start?.toISOString().slice(0, 10) || '';
    const newEnd = arg.event.end ? new Date(arg.event.end.getTime() - 86400000).toISOString().slice(0, 10) : newStart;
    updateTaskMutation.mutate({ taskId, data: { planned_start_date: newStart, planned_end_date: newEnd } as Partial<Task> });
  }, [updateTaskMutation]);

  const handleEventResize = useCallback((arg: EventChangeArg) => {
    const taskId = Number(arg.event.id);
    const newStart = arg.event.start?.toISOString().slice(0, 10) || '';
    const newEnd = arg.event.end ? new Date(arg.event.end.getTime() - 86400000).toISOString().slice(0, 10) : newStart;
    updateTaskMutation.mutate({ taskId, data: { planned_start_date: newStart, planned_end_date: newEnd } as Partial<Task> });
  }, [updateTaskMutation]);

  const fcEvents = events.map((e) => ({
    id: String(e.id),
    title: e.title,
    start: e.planned_start_date,
    end: e.planned_end_date ? `${e.planned_end_date}T23:59:59` : e.planned_start_date,
    backgroundColor: e.status === 'done' ? '#22c55e' : e.status === 'in_progress' ? '#3b82f6' : e.status === 'blocked' ? '#ef4444' : '#6b7280',
    borderColor: 'transparent',
    textColor: '#fff',
    extendedProps: { task: e },
  }));

  if (isLoading) return <div className="text-gray-400 py-8 text-center">加载中...</div>;
  if (isError) return <div className="text-red-400 py-8 text-center">加载失败，请刷新重试</div>;

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-4">日程表</h2>
      <div className="bg-white rounded-lg border p-4">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek',
          }}
          events={fcEvents}
          editable={true}
          eventDurationEditable={true}
          datesSet={handleDatesSet}
          eventClick={handleEventClick}
          eventDrop={handleEventDrop}
          eventResize={handleEventResize}
          height="auto"
          locale="zh-cn"
          buttonText={{ today: '今天', month: '月', week: '周' }}
        />
      </div>

      {selectedTask && (
        <CompletionModal
          projectId={projectId}
          task={selectedTask}
          date={selectedDate}
          onClose={() => { setSelectedTask(null); setSelectedDate(''); }}
        />
      )}
    </div>
  );
}
