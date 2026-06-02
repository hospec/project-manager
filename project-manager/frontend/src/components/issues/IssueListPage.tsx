import { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '../../services/api';
import type { Issue, Personnel } from '../../types';
import ConfirmDialog from '../common/ConfirmDialog';
import EmptyState from '../common/EmptyState';

interface Props {
  projectId: number;
}

const STATUS_OPTIONS = [
  { value: 'open', label: '未处理' },
  { value: 'in_progress', label: '处理中' },
  { value: 'resolved', label: '已解决' },
  { value: 'closed', label: '已关闭' },
] as const;

const PRIORITY_OPTIONS = [
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
  { value: 'critical', label: '紧急' },
] as const;

type ColKey = 'title' | 'status' | 'priority' | 'assignee' | 'due_date';

const COLUMNS = [
  { key: 'title', label: '标题', resizable: true },
  { key: 'status', label: '状态', resizable: true },
  { key: 'priority', label: '优先级', resizable: true },
  { key: 'assignee', label: '责任人', resizable: true },
  { key: 'due_date', label: '截止日期', resizable: true },
] as const;

const DEFAULT_COL_WIDTHS: Record<string, number> = {
  title: 300, status: 90, priority: 80, assignee: 100, due_date: 110,
};

/** IssueTableHeader — column titles with resize handles, matching Tasks style */
function IssueTableHeader({ colWidths, onResize }: {
  colWidths: Record<string, number>;
  onResize: (key: string, w: number) => void;
}) {
  const resizingRef = useRef<{ key: string; startX: number; startWidth: number } | null>(null);

  const handleMouseDown = useCallback((key: string, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    const startX = e.clientX;
    const startWidth = colWidths[key] || 100;
    resizingRef.current = { key, startX, startWidth };

    const onMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      const delta = ev.clientX - resizingRef.current.startX;
      onResize(resizingRef.current.key, Math.max(40, resizingRef.current.startWidth + delta));
    };
    const onUp = () => {
      resizingRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [colWidths, onResize]);

  return (
    <div className="task-table-row" style={{ minHeight: 'auto' }}>
      {COLUMNS.map(col => (
        <div key={col.key} className="task-table-header-cell"
          style={{ width: colWidths[col.key] || 100, minWidth: colWidths[col.key] || 100, flex: 'none' }}>
          {col.label}
          {col.resizable && <div className="resize-handle" onMouseDown={(e) => handleMouseDown(col.key, e)} />}
        </div>
      ))}
      <div className="task-table-header-cell" style={{ width: 36, minWidth: 36, flex: 'none', padding: 0 }} />
    </div>
  );
}

export default function IssueListPage({ projectId }: Props) {
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [editingCell, setEditingCell] = useState<{ id: number; col: ColKey } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [savedCell, setSavedCell] = useState<{ id: number; col: ColKey } | null>(null);
  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('issue-table-columns');
      return saved ? { ...DEFAULT_COL_WIDTHS, ...JSON.parse(saved) } : { ...DEFAULT_COL_WIDTHS };
    } catch { return { ...DEFAULT_COL_WIDTHS }; }
  });
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);

  const { data: issues = [], isLoading, isError } = useQuery({
    queryKey: ['issues', projectId],
    queryFn: () => api.listIssues(projectId),
    staleTime: 0,
  });

  const { data: personnel = [] } = useQuery<Personnel[]>({
    queryKey: ['personnel'],
    queryFn: api.listPersonnel,
    staleTime: 5 * 60 * 1000,
  });

  const saveMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      api.updateIssue(projectId, id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['issues', projectId] }),
    onError: () => { toast.error('保存失败'); queryClient.invalidateQueries({ queryKey: ['issues', projectId] }); },
  });

  const createMutation = useMutation({
    mutationFn: (title: string) => api.createIssue(projectId, {
      title, description: '', assignee: '', status: 'open', priority: 'medium', due_date: '', metadata: '{}',
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['issues', projectId] }); toast.success('问题已创建'); setAdding(false); setNewTitle(''); },
    onError: () => toast.error('创建失败'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteIssue(projectId, id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['issues', projectId] }); toast.success('问题已删除'); },
    onError: () => toast.error('删除失败'),
  });

  const startEdit = useCallback((id: number, col: ColKey, currentValue: string) => {
    setEditingCell({ id, col });
    setEditValue(currentValue);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingCell(null); setEditValue('');
  }, []);

  const saveEdit = useCallback(() => {
    if (!editingCell) return;
    const issue = issues.find(i => i.id === editingCell.id);
    if (!issue) { setEditingCell(null); return; }
    const currentVal = String(issue[editingCell.col as keyof Issue] ?? '');
    if (editValue === currentVal) { setEditingCell(null); return; }
    saveMutation.mutate({ id: editingCell.id, data: { [editingCell.col]: editValue } });
    setSavedCell(editingCell);
    setTimeout(() => setSavedCell(null), 800);
    setEditingCell(null);
  }, [editingCell, editValue, issues, saveMutation]);

  useEffect(() => {
    if (!editingCell) return;
    if (inputRef.current instanceof HTMLInputElement) {
      inputRef.current.focus();
      inputRef.current.select();
      // Open date picker immediately for date fields
      if (editingCell.col === 'due_date') {
        try { inputRef.current.showPicker(); } catch {}
      }
    }
  }, [editingCell]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); saveEdit(); }
    else if (e.key === 'Escape') cancelEdit();
  };

  const handleColResize = (key: string, width: number) => {
    const next = { ...colWidths, [key]: Math.max(40, width) };
    setColWidths(next);
    localStorage.setItem('issue-table-columns', JSON.stringify(next));
  };

  const renderCell = (issue: Issue, col: ColKey, display: React.ReactNode, editEl?: React.ReactNode) => {
    const isEditing = editingCell?.id === issue.id && editingCell?.col === col;
    const isSaved = savedCell?.id === issue.id && savedCell?.col === col;

    if (isEditing && editEl) return editEl;

    return (
      <div className={`task-table-cell cursor-pointer hover:bg-gray-50/50 ${isSaved ? 'cell-saved' : ''}`}
        style={{ width: colWidths[col] || 100, flex: 'none' }}
        onClick={() => startEdit(issue.id, col, String(issue[col] ?? ''))}
      >{display}</div>
    );
  };

  if (isLoading) return <div className="text-gray-400 py-8 text-center">加载中...</div>;
  if (isError) return <div className="text-red-400 py-8 text-center">加载失败，请刷新重试</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-bold text-gray-900">待办/问题清单</h2>
        <button onClick={() => setAdding(true)} className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <Plus size={16} /> 新建问题
        </button>
      </div>

      {issues.length === 0 && !adding ? (
        <EmptyState title="暂无问题" description="记录项目中遇到的问题和待办事项" action={{ label: '新建问题', onClick: () => setAdding(true) }} />
      ) : (
        <div className="task-table">
          <IssueTableHeader colWidths={colWidths} onResize={handleColResize} />

          {adding && (
            <div className="task-table-row">
              <div className="task-table-cell" style={{ width: colWidths.title || 300, flex: 'none', padding: '2px 6px' }}>
                <input autoFocus value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && newTitle.trim()) createMutation.mutate(newTitle.trim());
                    if (e.key === 'Escape') { setAdding(false); setNewTitle(''); }
                  }}
                  onBlur={() => { if (!newTitle.trim()) { setAdding(false); setNewTitle(''); } }}
                  placeholder="输入问题标题，按 Enter 创建..." className="w-full px-2 py-1 text-sm text-gray-900 placeholder:text-gray-400 border border-blue-300 rounded focus:outline-none focus:border-blue-500" />
              </div>
            </div>
          )}

          {issues.map(issue => (
            <div key={issue.id} className="task-table-row group hover:bg-gray-50/30">
              {/* Title */}
              {editingCell?.id === issue.id && editingCell?.col === 'title' ? (
                <div className="task-table-cell cell-editing" style={{ width: colWidths.title || 300, flex: 'none', padding: '2px 6px' }}>
                  <input ref={inputRef as React.Ref<HTMLInputElement>} value={editValue}
                    onChange={e => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={handleKeyDown}
                    className="w-full px-1 py-0.5 text-sm text-gray-900 border-0 focus:outline-none bg-transparent" />
                </div>
              ) : (
                <div className="task-table-cell cursor-pointer hover:bg-gray-50/50"
                  style={{ width: colWidths.title || 300, flex: 'none' }}
                  onClick={() => startEdit(issue.id, 'title', issue.title)}>
                  <span className="text-sm text-gray-900 truncate">{issue.title}</span>
                </div>
              )}

              {/* Status */}
              {renderCell(issue, 'status',
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${
                  issue.status === 'open' ? 'bg-gray-100 text-gray-600' :
                  issue.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                  issue.status === 'resolved' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'
                }`}>{
                  issue.status === 'open' ? '未处理' :
                  issue.status === 'in_progress' ? '处理中' :
                  issue.status === 'resolved' ? '已解决' : '已关闭'
                }</span>,
                editingCell?.id === issue.id && editingCell?.col === 'status' ? (
                  <div className="task-table-cell cell-editing" style={{ width: colWidths.status || 90, flex: 'none', padding: '2px 6px' }}>
                    <select ref={inputRef as React.Ref<HTMLSelectElement>} value={editValue}
                      onChange={e => { saveMutation.mutate({ id: issue.id, data: { status: e.target.value } }); setEditingCell(null); }}
                      onBlur={saveEdit} onKeyDown={handleKeyDown}
                      className="w-full text-xs text-gray-900 border-0 focus:outline-none bg-transparent py-0.5">
                      {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                ) : undefined
              )}

              {/* Priority */}
              {renderCell(issue, 'priority',
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${
                  issue.priority === 'low' ? 'bg-gray-100 text-gray-600' :
                  issue.priority === 'medium' ? 'bg-blue-100 text-blue-700' :
                  issue.priority === 'high' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'
                }`}>{
                  issue.priority === 'low' ? '低' :
                  issue.priority === 'medium' ? '中' :
                  issue.priority === 'high' ? '高' : '紧急'
                }</span>,
                editingCell?.id === issue.id && editingCell?.col === 'priority' ? (
                  <div className="task-table-cell cell-editing" style={{ width: colWidths.priority || 80, flex: 'none', padding: '2px 6px' }}>
                    <select ref={inputRef as React.Ref<HTMLSelectElement>} value={editValue}
                      onChange={e => { saveMutation.mutate({ id: issue.id, data: { priority: e.target.value } }); setEditingCell(null); }}
                      onBlur={saveEdit} onKeyDown={handleKeyDown}
                      className="w-full text-xs text-gray-900 border-0 focus:outline-none bg-transparent py-0.5">
                      {PRIORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                ) : undefined
              )}

              {/* Assignee */}
              {renderCell(issue, 'assignee',
                <span className={issue.assignee ? 'text-gray-700 text-sm' : 'text-gray-400 text-sm'}>{issue.assignee || '-'}</span>,
                editingCell?.id === issue.id && editingCell?.col === 'assignee' ? (
                  <div className="task-table-cell cell-editing" style={{ width: colWidths.assignee || 100, flex: 'none', padding: '2px 6px' }}>
                    <input ref={inputRef as React.Ref<HTMLInputElement>} value={editValue}
                      onChange={e => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={handleKeyDown}
                      placeholder="负责人" list="personnel-list-issues"
                      className="w-full text-xs text-gray-900 placeholder:text-gray-400 border-0 focus:outline-none bg-transparent" />
                    <datalist id="personnel-list-issues">
                      {personnel.map(p => (
                        <option key={p.id} value={p.name}>{p.title ? `${p.name} — ${p.title}` : p.name}</option>
                      ))}
                    </datalist>
                  </div>
                ) : undefined
              )}

              {/* Due date */}
              {renderCell(issue, 'due_date',
                <span className={issue.due_date ? 'text-gray-700 text-sm' : 'text-gray-400 text-sm'}>{issue.due_date || '-'}</span>,
                editingCell?.id === issue.id && editingCell?.col === 'due_date' ? (
                  <div className="task-table-cell cell-editing" style={{ width: colWidths.due_date || 110, flex: 'none', padding: '2px 6px' }}>
                    <input ref={inputRef as React.Ref<HTMLInputElement>} type="date" value={editValue}
                      onChange={e => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={handleKeyDown}
                      className="w-full text-xs text-gray-900 border-0 focus:outline-none bg-transparent" />
                  </div>
                ) : undefined
              )}

              {/* Delete */}
              <div className="task-table-cell" style={{ width: 36, minWidth: 36, flex: 'none', justifyContent: 'center', padding: 2 }}>
                <button onClick={() => setDeletingId(issue.id)}
                  className="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-50 rounded text-red-400 hover:text-red-600 transition-opacity">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {deletingId !== null && (
        <ConfirmDialog open onClose={() => setDeletingId(null)}
          onConfirm={() => deleteMutation.mutate(deletingId)} title="删除问题" message="确定删除这个问题吗？" confirmLabel="删除" danger />
      )}
    </div>
  );
}
