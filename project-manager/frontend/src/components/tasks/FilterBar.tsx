import { useState, useRef, useEffect } from 'react';
import { Filter, X, ArrowUpDown } from 'lucide-react';

interface FilterState {
  search: string;
  priorities: string[];
  statuses: string[];
  assignee: string;
  sortBy: string;
  sortDir: 'asc' | 'desc';
}

interface Props {
  filters: FilterState;
  onChange: (f: FilterState) => void;
}

const PRIORITY_OPTIONS = [
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
  { value: 'critical', label: '紧急' },
];

const STATUS_OPTIONS = [
  { value: 'todo', label: '待办' },
  { value: 'in_progress', label: '进行中' },
  { value: 'done', label: '已完成' },
  { value: 'blocked', label: '阻塞' },
];

const SORT_OPTIONS = [
  { value: 'sort_order', label: '默认排序' },
  { value: 'priority', label: '优先级' },
  { value: 'status', label: '状态' },
  { value: 'planned_end_date', label: '计划完成日期' },
  { value: 'created_at', label: '创建时间' },
];

export type { FilterState };

export function defaultFilters(): FilterState {
  return { search: '', priorities: [], statuses: [], assignee: '', sortBy: 'sort_order', sortDir: 'asc' };
}

export function applyFilters<T extends { title: string; priority: string; status: string; assignee: string }>(
  tasks: T[],
  f: FilterState
): T[] {
  let result = tasks;

  if (f.search) {
    const q = f.search.toLowerCase();
    result = result.filter(t => t.title.toLowerCase().includes(q) || t.assignee.toLowerCase().includes(q));
  }
  if (f.priorities.length > 0) {
    result = result.filter(t => f.priorities.includes(t.priority));
  }
  if (f.statuses.length > 0) {
    result = result.filter(t => f.statuses.includes(t.status));
  }
  if (f.assignee) {
    const a = f.assignee.toLowerCase();
    result = result.filter(t => t.assignee.toLowerCase().includes(a));
  }

  // Sort
  const dir = f.sortDir === 'asc' ? 1 : -1;
  const priorityOrder: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
  const statusOrder: Record<string, number> = { blocked: 4, in_progress: 3, todo: 2, done: 1 };

  result = [...result].sort((a, b) => {
    switch (f.sortBy) {
      case 'priority':
        return (priorityOrder[a.priority] || 0) - (priorityOrder[b.priority] || 0) * dir;
      case 'status':
        return ((statusOrder[a.status] || 0) - (statusOrder[b.status] || 0)) * dir;
      case 'planned_end_date':
        return ((a as any).planned_end_date || '').localeCompare((b as any).planned_end_date || '') * dir;
      case 'created_at':
        return ((a as any).created_at || '').localeCompare((b as any).created_at || '') * dir;
      default:
        return 0;
    }
  });

  return result;
}

export default function FilterBar({ filters, onChange }: Props) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const hasFilters = filters.search || filters.priorities.length > 0 || filters.statuses.length > 0 || filters.assignee || filters.sortBy !== 'sort_order';

  const togglePriority = (v: string) => {
    const next = filters.priorities.includes(v)
      ? filters.priorities.filter(p => p !== v)
      : [...filters.priorities, v];
    onChange({ ...filters, priorities: next });
  };

  const toggleStatus = (v: string) => {
    const next = filters.statuses.includes(v)
      ? filters.statuses.filter(s => s !== v)
      : [...filters.statuses, v];
    onChange({ ...filters, statuses: next });
  };

  return (
    <div ref={barRef} className="flex items-center gap-2 mb-3 flex-wrap relative">
      {/* Search */}
      <div className="relative">
        <input
          value={filters.search}
          onChange={e => onChange({ ...filters, search: e.target.value })}
          placeholder="搜索任务名或负责人..."
          className="pl-8 pr-3 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 w-52"
        />
        <svg className="absolute left-2.5 top-2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>

      {/* Priority filter */}
      <div className="relative">
        <button
          onClick={() => setOpenMenu(openMenu === 'priority' ? null : 'priority')}
          className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
            filters.priorities.length > 0
              ? 'border-blue-300 bg-blue-50 text-blue-700'
              : 'border-gray-300 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Filter size={14} />
          优先级{filters.priorities.length > 0 ? ` (${filters.priorities.length})` : ''}
        </button>
        {openMenu === 'priority' && (
          <div className="filter-popover">
            {PRIORITY_OPTIONS.map(o => (
              <label key={o.value} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 rounded cursor-pointer text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={filters.priorities.includes(o.value)}
                  onChange={() => togglePriority(o.value)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                {o.label}
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Status filter */}
      <div className="relative">
        <button
          onClick={() => setOpenMenu(openMenu === 'status' ? null : 'status')}
          className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
            filters.statuses.length > 0
              ? 'border-blue-300 bg-blue-50 text-blue-700'
              : 'border-gray-300 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Filter size={14} />
          状态{filters.statuses.length > 0 ? ` (${filters.statuses.length})` : ''}
        </button>
        {openMenu === 'status' && (
          <div className="filter-popover">
            {STATUS_OPTIONS.map(o => (
              <label key={o.value} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 rounded cursor-pointer text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={filters.statuses.includes(o.value)}
                  onChange={() => toggleStatus(o.value)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                {o.label}
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Sort */}
      <div className="relative">
        <button
          onClick={() => setOpenMenu(openMenu === 'sort' ? null : 'sort')}
          className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
            filters.sortBy !== 'sort_order'
              ? 'border-blue-300 bg-blue-50 text-blue-700'
              : 'border-gray-300 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <ArrowUpDown size={14} />
          {SORT_OPTIONS.find(o => o.value === filters.sortBy)?.label || '排序'}
        </button>
        {openMenu === 'sort' && (
          <div className="filter-popover">
            {SORT_OPTIONS.map(o => (
              <button
                key={o.value}
                onClick={() => {
                  if (filters.sortBy === o.value) {
                    onChange({ ...filters, sortDir: filters.sortDir === 'asc' ? 'desc' : 'asc' });
                  } else {
                    onChange({ ...filters, sortBy: o.value, sortDir: 'asc' });
                  }
                  setOpenMenu(null);
                }}
                className={`w-full text-left px-3 py-1.5 hover:bg-gray-50 rounded text-sm ${
                  filters.sortBy === o.value ? 'text-blue-700 font-medium' : 'text-gray-700'
                }`}
              >
                {o.label}
                {filters.sortBy === o.value && (
                  <span className="ml-1 text-xs text-gray-400">
                    {filters.sortDir === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Clear all */}
      {hasFilters && (
        <button
          onClick={() => onChange(defaultFilters())}
          className="flex items-center gap-1 px-2 py-1.5 text-sm text-gray-400 hover:text-gray-600"
        >
          <X size={14} />
          清除筛选
        </button>
      )}
    </div>
  );
}
