import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { useCallback, useRef } from 'react';
import type { Note } from '../../types';
import { api } from '../../services/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';


interface Props {
  note: Note;
  projectId: number;
}

export default function NoteEditor({ note, projectId }: Props) {
  const queryClient = useQueryClient();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveMutation = useMutation({
    mutationFn: (content: string) => api.updateNote(projectId, note.id, { content }),
  });

  const titleMutation = useMutation({
    mutationFn: (title: string) => api.updateNote(projectId, note.id, { title }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes', projectId] });
    },
  });

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: '开始记录...' }),
    ],
    content: note.content || '',
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        saveMutation.mutate(html);
      }, 1000);
    },
    immediatelyRender: false,
  });

  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    titleMutation.mutate(e.target.value);
  }, [titleMutation]);

  const togglePin = () => {
    api.updateNote(projectId, note.id, { is_pinned: !note.is_pinned }).then(() => {
      queryClient.invalidateQueries({ queryKey: ['notes', projectId] });
    });
  };

  if (!editor) return null;

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <input
          defaultValue={note.title}
          onBlur={handleTitleChange}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          className="flex-1 text-lg font-semibold text-gray-900 placeholder:text-gray-400 px-2 py-1.5 border border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white hover:border-gray-300 transition-colors"
          placeholder="笔记标题"
        />
        <button
          onClick={togglePin}
          className={`px-2 py-1 text-xs rounded border ${note.is_pinned ? 'bg-yellow-100 border-yellow-300 text-yellow-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
        >
          {note.is_pinned ? '已置顶' : '置顶'}
        </button>
      </div>

      <div
        className="bg-white rounded-lg border border-gray-200 p-4 flex-1 min-h-[300px] cursor-text focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500 transition-colors"
        onClick={() => editor.commands.focus()}
      >
        <EditorContent editor={editor} className="prose prose-sm max-w-none h-full [&_.ProseMirror]:min-h-[260px] [&_.ProseMirror]:outline-none" />
      </div>

      <div className="text-xs text-gray-400 mt-2">
        最后更新: {note.updated_at} | 自动保存已启用
      </div>
    </div>
  );
}
