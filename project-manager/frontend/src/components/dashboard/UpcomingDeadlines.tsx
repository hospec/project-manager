import type { DeadlineItem } from '../../types';

export default function UpcomingDeadlines({ deadlines }: { deadlines: DeadlineItem[] }) {
  const list = deadlines ?? [];

  return (
    <div className="bg-white rounded-lg border p-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">即将到期（7天内）</h3>
      {list.length === 0 ? (
        <div className="text-sm text-gray-400 py-4 text-center">
          <p>暂无即将到期的任务</p>
          <p className="text-xs mt-1 text-gray-300">在任务中设置"计划完成日期"，7天内到期的任务会显示在此</p>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((d) => (
            <div key={d.id} className="flex items-center gap-2 py-2 border-b last:border-0">
              <span className="text-sm flex-1 truncate">{d.title}</span>
              {d.assignee && <span className="text-xs text-gray-400">@{d.assignee}</span>}
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                d.days_until <= 1 ? 'bg-red-100 text-red-700' :
                d.days_until <= 3 ? 'bg-orange-100 text-orange-700' :
                'bg-yellow-100 text-yellow-700'
              }`}>
                {d.days_until === 0 ? '今天' : `${d.days_until}天后`}
              </span>
              <span className="text-xs text-gray-400">{d.planned_end_date}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
