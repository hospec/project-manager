import { useState, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../../services/api';

interface Props {
  projectId: number;
  taskId: number;
  date: string;
  initialContent: string;
}

const CLS =
  'w-full resize-none text-xs text-gray-900 placeholder:text-gray-300 ' +
  'rounded px-1.5 py-1 border border-dashed border-gray-200 ' +
  'hover:border-gray-300 focus:border-blue-400 focus:bg-blue-50/30 ' +
  'focus:outline-none focus:ring-1 focus:ring-blue-300 ' +
  'transition-colors';

function autoGrow(el: HTMLTextAreaElement) {
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

export default function TaskDailyCell({ projectId, taskId, date, initialContent }: Props) {
  const [value, setValue] = useState(initialContent);
  const ref = useRef<HTMLTextAreaElement>(null);
  const prevInitRef = useRef(initialContent);

  // Sync from parent when initialContent changes (e.g. query refetch from another week)
  useEffect(() => {
    if (initialContent !== prevInitRef.current) {
      setValue(initialContent);
      prevInitRef.current = initialContent;
    }
  }, [initialContent]);

  // Auto-grow on mount and when value changes
  useEffect(() => {
    if (ref.current) autoGrow(ref.current);
  }, [value]);

  const mutation = useMutation({
    mutationFn: (content: string) => api.updateDailyNotes(projectId, taskId, date, content),
    onError: () => toast.error('保存失败'),
  });

  const handleBlur = () => {
    if (value !== (initialContent ?? '')) {
      mutation.mutate(value);
      prevInitRef.current = value;
    }
  };

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleBlur}
      placeholder="..."
      rows={1}
      className={CLS}
      style={{ minHeight: '28px' }}
      onFocus={(e) => autoGrow(e.target)}
    />
  );
}
