import { useState, useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Note } from '../../types';
import { api } from '../../services/api';

interface Props {
  note: Note;
  projectId: number;
}

export default function NoteEditor({ note, projectId }: Props) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(note.title);

  // Sync title when note id changes
  useEffect(() => {
    setTitle(note.title);
  }, [note.id]);

  const saveContentMu = useMutation({
    mutationFn: (content: string) => api.updateNote(projectId, note.id, { content }),
  });

  const saveTitleMu = useMutation({
    mutationFn: (t: string) => api.updateNote(projectId, note.id, { title: t }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notes', projectId] }),
  });

  // Guard against stale callbacks during editor destruction (switching notes)
  const destroyingRef = useRef(false);
  useEffect(() => () => { destroyingRef.current = true; }, []);

  const saveContent = (html: string) => {
    if (destroyingRef.current) return;
    if (html !== note.content) {
      // Optimistically update cache so the content is visible immediately on return
      queryClient.setQueryData<Note[]>(['notes', projectId], (old = []) =>
        old.map(n => n.id === note.id ? { ...n, content: html } : n)
      );
      saveContentMu.mutate(html);
    }
  };

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: '开始记录...' }),
    ],
    content: note.content || '',
    onBlur: ({ editor: ed }) => {
      saveContent(ed.getHTML());
    },
    immediatelyRender: false,
  });

  // Sync editor content when note.content changes from external source
  const noteIdRef = useRef(note.id);
  useEffect(() => {
    if (editor && note.id !== noteIdRef.current) {
      editor.commands.setContent(note.content || '');
      noteIdRef.current = note.id;
    }
  }, [editor, note.id, note.content]);

  const handleTitleBlur = () => {
    if (title.trim() !== note.title.trim()) {
      saveTitleMu.mutate(title);
    }
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
  };

  const togglePin = () => {
    api.updateNote(projectId, note.id, { is_pinned: !note.is_pinned }).then(() => {
      queryClient.invalidateQueries({ queryKey: ['notes', projectId] });
    });
  };

  if (!editor) return null;

  return (
    <div className="flex flex-col h-full p-4">
      <div className="flex items-center gap-2 mb-4">
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          onBlur={handleTitleBlur}
          onKeyDown={handleTitleKeyDown}
          className="flex-1 text-lg font-semibold text-gray-900 placeholder:text-gray-400 px-2 py-1.5 border border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white hover:border-gray-300 transition-colors"
          placeholder="笔记标题"
        />
        <button onClick={togglePin}
          className={`px-2 py-1 text-xs rounded border ${note.is_pinned ? 'bg-yellow-100 border-yellow-300 text-yellow-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
          {note.is_pinned ? '已置顶' : '置顶'}
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4 flex-1 min-h-[300px] editor-wrapper focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500 transition-colors">
        <EditorContent editor={editor} className="prose prose-sm max-w-none h-full [&_.ProseMirror]:min-h-[260px] [&_.ProseMirror]:outline-none" />
      </div>

      <div className="text-xs text-gray-400 mt-2">
        最后更新: {note.updated_at} · {saveContentMu.isPending || saveTitleMu.isPending ? '保存中...' : '已保存'}
      </div>
    </div>
  );
}
