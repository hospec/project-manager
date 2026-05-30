import { NavLink } from 'react-router-dom';
import { LayoutDashboard, ListTodo, Calendar, AlertCircle, StickyNote } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import ProjectSwitcher from '../project/ProjectSwitcher';

const navItems = [
  { to: 'dashboard', icon: LayoutDashboard, label: '项目概览' },
  { to: 'tasks', icon: ListTodo, label: '任务清单' },
  { to: 'calendar', icon: Calendar, label: '日程表' },
  { to: 'issues', icon: AlertCircle, label: '待办/问题' },
  { to: 'notes', icon: StickyNote, label: '关键信息' },
];

export default function Sidebar() {
  const { selectedProjectId } = useProject();

  return (
    <aside className="w-60 bg-gray-900 text-white flex flex-col h-screen">
      <div className="p-4 border-b border-gray-700">
        <h1 className="text-lg font-bold text-white">PM Tool</h1>
      </div>

      <div className="p-3 border-b border-gray-700">
        <ProjectSwitcher />
      </div>

      <nav className="flex-1 p-2">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={selectedProjectId ? `/projects/${selectedProjectId}/${to}` : '#'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg mb-1 text-sm transition-colors ${
                isActive ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800'
              } ${!selectedProjectId ? 'opacity-50 pointer-events-none' : ''}`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-gray-700 text-xs text-gray-500">
        v1.0.0
      </div>
    </aside>
  );
}
