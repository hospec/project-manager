import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../../services/api';
import type { ProjectPhase } from '../../types';

// Color to Tailwind class mapping for buttons
const colorActiveMap: Record<string, string> = {
  blue: 'bg-blue-600 text-white',
  green: 'bg-green-600 text-white',
  yellow: 'bg-yellow-500 text-white',
  purple: 'bg-purple-600 text-white',
  red: 'bg-red-600 text-white',
  orange: 'bg-orange-600 text-white',
  teal: 'bg-teal-600 text-white',
  slate: 'bg-slate-600 text-white',
};

const colorDoneMap: Record<string, string> = {
  blue: 'bg-blue-100 text-blue-700',
  green: 'bg-green-100 text-green-700',
  yellow: 'bg-yellow-100 text-yellow-700',
  purple: 'bg-purple-100 text-purple-700',
  red: 'bg-red-100 text-red-700',
  orange: 'bg-orange-100 text-orange-700',
  teal: 'bg-teal-100 text-teal-700',
  slate: 'bg-slate-100 text-slate-700',
};

interface Props {
  currentPhase: string;
  projectId: number;
}

export default function PhaseIndicator({ currentPhase, projectId }: Props) {
  const queryClient = useQueryClient();

  const { data: phases = [] } = useQuery<ProjectPhase[]>({
    queryKey: ['phases'],
    queryFn: api.listPhases,
    staleTime: 5 * 60 * 1000,
  });

  // Find current phase by matching phase_key
  const currentIdx = phases.findIndex(p => p.phase_key === currentPhase);

  const updatePhaseMutation = useMutation({
    mutationFn: (phase_key: string) => api.updateProject(projectId, { phase: phase_key }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['overview', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('阶段已更新');
    },
    onError: () => toast.error('更新失败'),
  });

  if (phases.length === 0) return null;

  return (
    <div className="flex items-center gap-1">
      {phases.map((phase, i) => {
        const isActive = phase.phase_key === currentPhase;
        const isDone = !isActive && currentIdx >= 0 && i < currentIdx;
        const defaultClass = 'bg-gray-100 text-gray-400';

        let cls = defaultClass;
        if (isActive) cls = colorActiveMap[phase.color] || 'bg-blue-600 text-white';
        else if (isDone) cls = colorDoneMap[phase.color] || 'bg-blue-100 text-blue-700';

        return (
          <div key={phase.id} className="flex items-center">
            {i > 0 && (
              <div className={`w-6 h-0.5 ${isDone || isActive ? 'bg-blue-500' : 'bg-gray-200'}`} />
            )}
            <button
              onClick={() => updatePhaseMutation.mutate(phase.phase_key)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${cls}`}
            >
              {phase.label}
            </button>
          </div>
        );
      })}
    </div>
  );
}
