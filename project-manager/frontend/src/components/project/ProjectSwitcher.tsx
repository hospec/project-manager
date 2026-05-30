import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Plus, Settings, Trash2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../../services/api';
import { useProject } from '../../context/ProjectContext';
import ProjectFormModal from './ProjectFormModal';
import ConfirmDialog from '../common/ConfirmDialog';

export default function ProjectSwitcher() {
  const { selectedProjectId, setSelectedProjectId } = useProject();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingProject, setEditingProject] = useState<number | null>(null);
  const [deletingProject, setDeletingProject] = useState<{ id: number; name: string } | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteProject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('项目已删除');
      if (deletingProject && selectedProjectId === deletingProject.id) {
        setSelectedProjectId(null);
        navigate('/projects');
      }
      setDeletingProject(null);
    },
    onError: (err) => { console.error('deleteProject failed:', err); toast.error('删除失败: ' + (err instanceof Error ? err.message : String(err))); },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: api.listProjects,
  });

  const selected = projects.find((p) => p.id === selectedProjectId);

  const handleSelect = (id: number) => {
    setSelectedProjectId(id);
    setOpen(false);
    navigate(`/projects/${id}/dashboard`);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-800 rounded-lg text-sm text-white hover:bg-gray-700"
      >
        <span className="truncate">{selected?.name || '选择项目...'}</span>
        <ChevronDown size={16} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full mt-1 w-full bg-gray-800 rounded-lg shadow-lg z-20 py-1">
            {projects.map((p) => (
              <div key={p.id} className="flex items-center">
                <button
                  onClick={() => handleSelect(p.id)}
                  className={`flex-1 text-left px-3 py-2 text-sm hover:bg-gray-700 ${
                    p.id === selectedProjectId ? 'text-blue-400' : 'text-gray-300'
                  }`}
                >
                  {p.name}
                </button>
                <button
                  onClick={() => { setEditingProject(p.id); setShowForm(true); setOpen(false); }}
                  className="px-2 py-2 text-gray-500 hover:text-gray-300"
                  title="编辑项目"
                >
                  <Settings size={14} />
                </button>
                <button
                  onClick={() => { setDeletingProject({ id: p.id, name: p.name }); setOpen(false); }}
                  className="px-2 py-2 text-gray-500 hover:text-red-400"
                  title="删除项目"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button
              onClick={() => { setShowForm(true); setEditingProject(null); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:bg-gray-700 border-t border-gray-700 mt-1"
            >
              <Plus size={16} /> 新建项目
            </button>
          </div>
        </>
      )}

      {showForm && (
        <ProjectFormModal
          projectId={editingProject}
          onClose={() => { setShowForm(false); setEditingProject(null); }}
          onCreated={(id) => { handleSelect(id); setShowForm(false); setEditingProject(null); }}
        />
      )}

      {deletingProject && (
        <ConfirmDialog
          open
          onClose={() => setDeletingProject(null)}
          onConfirm={() => deleteMutation.mutate(deletingProject.id)}
          title="删除项目"
          message={`确定删除项目「${deletingProject.name}」吗？\n项目中的所有任务、问题、笔记等数据将被永久删除。`}
          confirmLabel="删除"
          danger
        />
      )}
    </div>
  );
}
