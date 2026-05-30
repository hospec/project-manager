import { useDroppable } from '@dnd-kit/core';

interface Props {
  groupId: number | null;
  colCount: number;
}

export default function DropTargetRow({ groupId, colCount }: Props) {
  const id = `drop-zone-${groupId ?? 'ungrouped'}`;
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: { type: 'drop-zone', group_id: groupId },
  });

  return (
    <div
      ref={setNodeRef}
      className={`transition-colors ${isOver ? 'bg-blue-100' : ''}`}
      style={{ height: 6, minHeight: 6 }}
    />
  );
}
