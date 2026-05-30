import type { Task } from '../../types';
import { PriorityBadge } from '../common/StatusBadge';

export default function RiskList({ risks }: { risks: Task[] }) {
  const list = risks ?? [];

  return (
    <div className="bg-white rounded-lg border p-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">风险 / 阻塞任务</h3>
      {list.length === 0 ? (
        <div className="text-sm text-gray-400 py-4 text-center">
          <p>暂无风险</p>
          <p className="text-xs mt-1 text-gray-300">在任务中将状态设为"阻塞"，即可在此查看</p>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((risk) => (
            <div key={risk.id} className="flex items-center gap-2 py-2 border-b last:border-0">
              <span className="text-sm flex-1 truncate">{risk.title}</span>
              {risk.assignee && <span className="text-xs text-gray-400">@{risk.assignee}</span>}
              <PriorityBadge priority={risk.priority} />
              {risk.planned_end_date && <span className="text-xs text-red-500">{risk.planned_end_date}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
