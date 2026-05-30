import { Download, Upload } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { api } from '../../services/api';
import { toast } from 'sonner';
import { useRef } from 'react';

export default function Header() {
  const { selectedProjectId } = useProject();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    if (!selectedProjectId) return;
    try {
      const data = await api.exportProject(selectedProjectId);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `project-export-${selectedProjectId}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('导出成功');
    } catch {
      toast.error('导出失败');
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await api.importData(file);
      toast.success(result.message || '导入成功');
    } catch {
      toast.error('导入失败');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <header className="h-14 bg-white border-b flex items-center justify-between px-6">
      <div className="text-sm text-gray-500">
        {selectedProjectId ? '已选择项目' : '请选择一个项目'}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleExport}
          disabled={!selectedProjectId}
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          <Download size={16} /> 导出
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <Upload size={16} /> 导入
        </button>
        <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
      </div>
    </header>
  );
}
