import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../../services/api';
import type { ProjectFormData } from '../../types';

const phases = [
  { key: 'planning' as const, label: '规划', step: 1 },
  { key: 'execution' as const, label: '执行', step: 2 },
  { key: 'monitoring' as const, label: '监控', step: 3 },
  { key: 'closure' as const, label: '收尾', step: 4 },
];

interface Props {
  currentPhase: string;
  projectId: number;
}

export default function PhaseIndicator({ currentPhase, projectId }: Props) {
  const queryClient = useQueryClient();
  const currentStep = phases.find((p) => p.key === currentPhase)?.step ?? 1;

  const updatePhaseMutation = useMutation({
    mutationFn: (phase: ProjectFormData['phase']) => api.updateProject(projectId, { phase }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['overview', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('阶段已更新');
    },
    onError: () => toast.error('更新失败'),
  });

  return (
    <div className="flex items-center gap-1">
      {phases.map((phase, i) => (
        <div key={phase.key} className="flex items-center">
          {i > 0 && <div className={`w-6 h-0.5 ${phase.step <= currentStep ? 'bg-blue-500' : 'bg-gray-200'}`} />}
          <button
            onClick={() => updatePhaseMutation.mutate(phase.key)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              phase.key === currentPhase
                ? 'bg-blue-600 text-white'
                : phase.step < currentStep
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-400'
            }`}
          >
            {phase.label}
          </button>
        </div>
      ))}
    </div>
  );
}
