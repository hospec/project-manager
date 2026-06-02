import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { arrayMove } from '@dnd-kit/sortable';
import { GripVertical, Pencil, Trash2, Plus } from 'lucide-react';
import { api } from '../../services/api';
import type { ProjectPhase } from '../../types';

const COLOR_OPTIONS = [
  { value: 'blue', label: '蓝色', badge: 'bg-blue-100 text-blue-700' },
  { value: 'green', label: '绿色', badge: 'bg-green-100 text-green-700' },
  { value: 'yellow', label: '黄色', badge: 'bg-yellow-100 text-yellow-700' },
  { value: 'purple', label: '紫色', badge: 'bg-purple-100 text-purple-700' },
  { value: 'red', label: '红色', badge: 'bg-red-100 text-red-700' },
  { value: 'orange', label: '橙色', badge: 'bg-orange-100 text-orange-700' },
  { value: 'teal', label: '青色', badge: 'bg-teal-100 text-teal-700' },
  { value: 'slate', label: '灰色', badge: 'bg-slate-100 text-slate-700' },
];

interface EditModalProps {
  phase?: ProjectPhase | null;
  onClose: () => void;
}

function EditModal({ phase, onClose }: EditModalProps) {
  const queryClient = useQueryClient();
  const [key, setKey] = useState(phase?.phase_key || '');
  const [label, setLabel] = useState(phase?.label || '');
  const [color, setColor] = useState(phase?.color || 'blue');

  const createMutation = useMutation({
    mutationFn: () => api.createPhase({ phase_key: key, label, color }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['phases'] });
      toast.success('阶段已添加');
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: () => api.updatePhase(phase!.id, { label, color }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['phases'] });
      toast.success('阶段已更新');
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSubmit = () => {
    if (!key.trim() || !label.trim()) {
      toast.error('Key 和名称不能为空');
      return;
    }
    if (phase) updateMutation.mutate();
    else createMutation.mutate();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg p-6 w-96 shadow-xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {phase ? '编辑阶段' : '新增阶段'}
        </h3>
        <div className="space-y-4">
          {!phase && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Key (英文标识)</label>
              <input
                value={key}
                onChange={e => setKey(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                placeholder="如 planning, development"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">显示名称</label>
            <input
              value={label}
              onChange={e => setLabel(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              placeholder="如 规划、开发"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">颜色</label>
            <div className="grid grid-cols-4 gap-2">
              {COLOR_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setColor(opt.value)}
                  className={`px-2 py-1 rounded text-xs font-medium ${opt.badge} ${
                    color === opt.value ? 'ring-2 ring-blue-500 ring-offset-1' : ''
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
            取消
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            {phase ? '保存' : '添加'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SortablePhase({ phase, onEdit, onDelete }: {
  phase: ProjectPhase;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: phase.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const badgeClass = COLOR_OPTIONS.find(c => c.value === phase.color)?.badge || 'bg-gray-100 text-gray-700';

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200">
      <button {...attributes} {...listeners} className="text-gray-400 hover:text-gray-600 cursor-grab">
        <GripVertical size={16} />
      </button>
      <span className="text-sm text-gray-500 w-8">{phase.sort_order + 1}</span>
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${badgeClass}`}>{phase.label}</span>
      <span className="text-xs text-gray-400 flex-1">{phase.phase_key}</span>
      <button onClick={onEdit} className="p-1 text-gray-400 hover:text-blue-600">
        <Pencil size={14} />
      </button>
      <button onClick={onDelete} className="p-1 text-gray-400 hover:text-red-600">
        <Trash2 size={14} />
      </button>
    </div>
  );
}

export default function PhaseConfig() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<ProjectPhase | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const { data: phases = [], isLoading } = useQuery({
    queryKey: ['phases'],
    queryFn: api.listPhases,
    staleTime: 5 * 60 * 1000,
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const reorderMutation = useMutation({
    mutationFn: (phases: ProjectPhase[]) =>
      api.reorderPhases(phases.map((p, i) => ({ id: p.id, sort_order: i }))),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['phases'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deletePhase(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['phases'] });
      toast.success('阶段已删除');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = phases.findIndex(p => p.id === active.id);
    const newIndex = phases.findIndex(p => p.id === over.id);
    const newPhases = arrayMove([...phases], oldIndex, newIndex);
    reorderMutation.mutate(newPhases);
  };

  if (isLoading) return <div className="text-gray-500 text-sm">加载中...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">拖拽调整顺序。修改后所有模块立即生效。</p>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus size={14} /> 新增阶段
        </button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={phases.map(p => p.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-1">
            {phases.map(phase => (
              <SortablePhase
                key={phase.id}
                phase={phase}
                onEdit={() => setEditing(phase)}
                onDelete={() => {
                  if (phases.length <= 1) {
                    toast.error('至少保留一个阶段');
                    return;
                  }
                  deleteMutation.mutate(phase.id);
                }}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {phases.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-8">暂无阶段，请添加</p>
      )}

      {(showAdd || editing) && (
        <EditModal
          phase={editing}
          onClose={() => { setShowAdd(false); setEditing(null); }}
        />
      )}
    </div>
  );
}
