import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import PhaseIndicator from './PhaseIndicator';
import TaskCompletionChart from './TaskCompletionChart';
import RiskList from './RiskList';
import UpcomingDeadlines from './UpcomingDeadlines';

interface Props {
  projectId: number;
}

export default function ProjectOverview({ projectId }: Props) {
  const { data: overview, isLoading, isError } = useQuery({
    queryKey: ['overview', projectId],
    queryFn: () => api.getOverview(projectId),
    staleTime: 0,
  });

  if (isLoading) return <div className="text-gray-400 py-8 text-center">加载中...</div>;
  if (isError || !overview) return <div className="text-red-400 py-8 text-center">加载失败，请刷新重试</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{overview.project.name}</h2>
          <p className="text-sm text-gray-500 mt-1">{overview.project.description || '暂无描述'}</p>
        </div>
        <PhaseIndicator currentPhase={overview.project.phase} projectId={projectId} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <TaskCompletionChart stats={overview.task_completion} />
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-lg border p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{overview.task_completion.total}</div>
              <div className="text-xs text-gray-500 mt-1">总任务</div>
            </div>
            <div className="bg-white rounded-lg border p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{overview.recent_completions}</div>
              <div className="text-xs text-gray-500 mt-1">近7天完成</div>
            </div>
            <div className="bg-white rounded-lg border p-4 text-center">
              <div className="text-2xl font-bold text-orange-600">{overview.open_issue_count}</div>
              <div className="text-xs text-gray-500 mt-1">待处理问题</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RiskList risks={overview.risks} />
        <UpcomingDeadlines deadlines={overview.upcoming_deadlines} />
      </div>
    </div>
  );
}
