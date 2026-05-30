import { Plus, Pin, Trash2 } from 'lucide-react';
import type { Note } from '../../types';

interface Props {
  notes: Note[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onCreate: () => void;
  onDelete: (id: number) => void;
}

export default function NoteList({ notes, selectedId, onSelect, onCreate, onDelete }: Props) {
  return (
    <div className="w-64 flex-shrink-0 border-r bg-gray-50 flex flex-col">
      <div className="p-3 border-b flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-700">笔记列表</span>
        <button onClick={onCreate} className="p-1 hover:bg-blue-100 rounded text-blue-600">
          <Plus size={16} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {notes.length === 0 ? (
          <p className="text-sm text-gray-400 p-4">暂无笔记</p>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              onClick={() => onSelect(note.id)}
              className={`group flex items-center gap-2 px-3 py-2 cursor-pointer border-b hover:bg-gray-100 ${
                note.id === selectedId ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  {note.is_pinned && <Pin size={12} className="text-yellow-500" />}
                  <span className="text-sm text-gray-900 truncate">{note.title || '未命名笔记'}</span>
                </div>
                <div className="text-xs text-gray-400 mt-0.5">{note.updated_at?.slice(0, 10)}</div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(note.id); }}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded text-red-500"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
