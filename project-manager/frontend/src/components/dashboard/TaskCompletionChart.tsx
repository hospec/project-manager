import type { TaskCompletionStats } from '../../types';

export default function TaskCompletionChart({ stats }: { stats: TaskCompletionStats }) {
  if (stats.total === 0) {
    return (
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">任务完成情况</h3>
        <p className="text-sm text-gray-400 text-center py-8">暂无任务数据</p>
      </div>
    );
  }

  const pct = (v: number) => (v / stats.total) * 100;
  const segments = [
    { label: '已完成', value: stats.done, color: '#22c55e', pct: pct(stats.done) },
    { label: '进行中', value: stats.in_progress, color: '#3b82f6', pct: pct(stats.in_progress) },
    { label: '待办', value: stats.todo, color: '#d1d5db', pct: pct(stats.todo) },
    { label: '阻塞', value: stats.blocked, color: '#ef4444', pct: pct(stats.blocked) },
  ];

  const gradientParts = segments
    .filter((s) => s.value > 0)
    .reduce<{ pct: number; parts: string[] }>(
      (acc, s) => {
        const from = acc.pct;
        const to = acc.pct + s.pct;
        acc.parts.push(`${s.color} ${from}% ${to}%`);
        acc.pct = to;
        return acc;
      },
      { pct: 0, parts: [] },
    );

  const gradient = gradientParts.parts.length > 0
    ? `conic-gradient(from -90deg, ${gradientParts.parts.join(', ')})`
    : '#e5e7eb';

  return (
    <div className="bg-white rounded-lg border p-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">任务完成情况</h3>
      <div className="flex items-center gap-4">
        <div
          className="relative w-24 h-24 flex-shrink-0 rounded-full flex items-center justify-center"
          style={{ background: gradient }}
        >
          <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center">
            <span className="text-lg font-bold text-gray-900">{stats.percentage.toFixed(0)}%</span>
          </div>
        </div>
        <div className="flex-1 space-y-1.5">
          {segments.map((s) => (
            <div key={s.label} className="flex items-center gap-2 text-xs">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
              <span className="text-gray-500">{s.label}</span>
              <span className="font-medium text-gray-900 ml-auto">{s.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
