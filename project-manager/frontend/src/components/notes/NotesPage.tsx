import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../../services/api';
import NoteList from './NoteList';
import NoteEditor from './NoteEditor';
import ConfirmDialog from '../common/ConfirmDialog';
import EmptyState from '../common/EmptyState';

interface Props {
  projectId: number;
}

export default function NotesPage({ projectId }: Props) {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const { data: notes = [], isLoading, isError } = useQuery({
    queryKey: ['notes', projectId],
    queryFn: () => api.listNotes(projectId),
  });

  const createMutation = useMutation({
    mutationFn: () => api.createNote(projectId, { title: '新建笔记', content: '', is_pinned: false, metadata: '{}' }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['notes', projectId] });
      setSelectedId(data.id);
      toast.success('笔记已创建');
    },
    onError: () => toast.error('创建失败'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteNote(projectId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes', projectId] });
      if (selectedId === deletingId) setSelectedId(null);
      toast.success('笔记已删除');
    },
    onError: () => toast.error('删除失败'),
  });

  const selectedNote = notes.find((n) => n.id === selectedId);

  if (isLoading) return <div className="text-gray-400 py-8 text-center">加载中...</div>;
  if (isError) return <div className="text-red-400 py-8 text-center">加载失败，请刷新重试</div>;

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-4">关键信息</h2>
      {notes.length === 0 ? (
        <EmptyState title="暂无笔记" description="记录项目关键信息" action={{ label: '新建笔记', onClick: () => createMutation.mutate() }} />
      ) : (
        <div className="flex bg-white rounded-lg border overflow-hidden" style={{ height: 'calc(100vh - 200px)' }}>
          <NoteList
            notes={notes}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onCreate={() => createMutation.mutate()}
            onDelete={(id) => setDeletingId(id)}
          />
          <div className="flex-1 p-4 overflow-y-auto">
            {selectedNote ? (
              <NoteEditor key={selectedNote.id} note={selectedNote} projectId={projectId} />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                <p>选择一篇笔记开始编辑</p>
              </div>
            )}
          </div>
        </div>
      )}

      {deletingId !== null && (
        <ConfirmDialog
          open onClose={() => setDeletingId(null)}
          onConfirm={() => deleteMutation.mutate(deletingId)}
          title="删除笔记" message="确定删除这篇笔记吗？" confirmLabel="删除" danger
        />
      )}
    </div>
  );
}
