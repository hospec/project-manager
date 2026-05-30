import { useCallback, useRef } from 'react';

interface Props {
  colWidths: Record<string, number>;
  onResize: (key: string, width: number) => void;
}

const COLUMNS = [
  { key: '#', label: '#', resizable: true },
  { key: 'title', label: '任务名', resizable: true },
  { key: 'priority', label: '优先级', resizable: true },
  { key: 'planned_start_date', label: '计划开始', resizable: true },
  { key: 'planned_end_date', label: '计划完成', resizable: true },
  { key: 'assignee', label: '负责人', resizable: true },
  { key: 'status', label: '状态', resizable: true },
  { key: 'progress', label: '进展', resizable: true },
] as const;

export default function TaskTableHeader({ colWidths, onResize }: Props) {
  const resizingRef = useRef<{ key: string; startX: number; startWidth: number } | null>(null);

  const handleMouseDown = useCallback((key: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = colWidths[key] || 100;
    resizingRef.current = { key, startX, startWidth };

    const handleMouseMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      const delta = ev.clientX - resizingRef.current.startX;
      onResize(resizingRef.current.key, Math.max(40, resizingRef.current.startWidth + delta));
    };

    const handleMouseUp = () => {
      resizingRef.current = null;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [colWidths, onResize]);

  return (
    <div className="task-table-row" style={{ minHeight: 'auto' }}>
      {COLUMNS.map(col => (
        <div
          key={col.key}
          className="task-table-header-cell"
          style={{
            width: colWidths[col.key] || 60,
            minWidth: colWidths[col.key] || 60,
            flex: 'none',
          }}
        >
          {col.label}
          {col.resizable && (
            <div
              className="resize-handle"
              onMouseDown={(e) => handleMouseDown(col.key, e)}
            />
          )}
        </div>
      ))}
      {/* Delete button column spacer */}
      <div className="task-table-header-cell" style={{ width: 36, minWidth: 36, flex: 'none', padding: 0 }} />
    </div>
  );
}
