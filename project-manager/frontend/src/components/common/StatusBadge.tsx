import clsx from 'clsx';

const statusColors: Record<string, string> = {
  todo: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-100 text-blue-700',
  done: 'bg-green-100 text-green-700',
  blocked: 'bg-red-100 text-red-700',
  open: 'bg-gray-100 text-gray-700',
  resolved: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-500',
};

const statusLabels: Record<string, string> = {
  todo: '待办',
  in_progress: '进行中',
  done: '已完成',
  blocked: '阻塞',
  open: '未处理',
  resolved: '已解决',
  closed: '已关闭',
};

export default function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', statusColors[status] || 'bg-gray-100 text-gray-700', className)}>
      {statusLabels[status] || status}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    low: 'bg-gray-100 text-gray-500',
    medium: 'bg-yellow-100 text-yellow-700',
    high: 'bg-orange-100 text-orange-700',
    critical: 'bg-red-100 text-red-700',
  };
  const labels: Record<string, string> = {
    low: '低', medium: '中', high: '高', critical: '紧急',
  };
  return (
    <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', colors[priority] || '')}>
      {labels[priority] || priority}
    </span>
  );
}

export function PhaseBadge({ phase }: { phase: string }) {
  const labels: Record<string, string> = {
    planning: '规划', execution: '执行', monitoring: '监控', closure: '收尾',
  };
  const colors: Record<string, string> = {
    planning: 'bg-purple-100 text-purple-700',
    execution: 'bg-blue-100 text-blue-700',
    monitoring: 'bg-yellow-100 text-yellow-700',
    closure: 'bg-green-100 text-green-700',
  };
  return (
    <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', colors[phase] || '')}>
      {labels[phase] || phase}
    </span>
  );
}
