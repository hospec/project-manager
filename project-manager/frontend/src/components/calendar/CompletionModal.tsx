import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../../services/api';
import type { Task } from '../../types';
import Modal from '../common/Modal';
import StatusBadge from '../common/StatusBadge';

const completions = [
  { value: 'full', label: '完成' },
  { value: 'partial', label: '部分完成' },
  { value: 'none', label: '未完成' },
];

interface Props {
  projectId: number;
  task: Task;
  date: string;
  onClose: () => void;
}

export default function CompletionModal({ projectId, task, date, onClose }: Props) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('full');
  const [notes, setNotes] = useState('');

  const { data: calendarEvents = [] } = useQuery({
    queryKey: ['calendar', projectId],
    queryFn: () => api.getCalendarEvents(projectId, date, date),
  });

  const existingRecord = calendarEvents
    .flatMap((e) => e.completion_records || [])
    .find((r) => r.task_id === task.id && r.date === date);

  const recordMutation = useMutation({
    mutationFn: () => api.recordCompletion(projectId, {
      task_id: task.id, date, completion_status: status, notes,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar', projectId] });
      queryClient.invalidateQueries({ queryKey: ['overview', projectId] });
      toast.success('完成状态已记录');
      onClose();
    },
    onError: () => toast.error('记录失败'),
  });

  return (
    <Modal open onClose={onClose} title="记录任务完成情况" width="max-w-md">
      <div className="space-y-4">
        <div>
          <p className="font-medium text-gray-900">{task.title}</p>
          <div className="flex items-center gap-2 mt-1">
            <StatusBadge status={task.status} />
            <span className="text-sm text-gray-400">{date}</span>
          </div>
        </div>

        {existingRecord && (
          <div className="p-2 bg-gray-50 rounded text-xs text-gray-500">
            已有记录: {completions.find(c => c.value === existingRecord.completion_status)?.label}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">完成状态</label>
          <div className="flex gap-2">
            {completions.map((c) => (
              <button
                key={c.value}
                onClick={() => setStatus(c.value)}
                className={`px-3 py-1.5 rounded-lg text-sm border ${
                  status === c.value
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'hover:bg-gray-50'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            rows={2}
            placeholder="可选的备注信息"
          />
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">取消</button>
          <button
            onClick={() => recordMutation.mutate()}
            disabled={recordMutation.isPending}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            记录
          </button>
        </div>
      </div>
    </Modal>
  );
}
