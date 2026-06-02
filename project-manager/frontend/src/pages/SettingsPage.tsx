import { useState } from 'react';
import PhaseConfig from '../components/settings/PhaseConfig';
import PersonnelManager from '../components/settings/PersonnelManager';

type Tab = 'phases' | 'personnel';

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('phases');

  return (
    <div className="max-w-4xl mx-auto py-6 px-4">
      <h1 className="text-xl font-bold text-gray-900 mb-6">系统设置</h1>

      <div className="flex gap-1 mb-6 border-b border-gray-200">
        <button
          onClick={() => setTab('phases')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            tab === 'phases'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          项目阶段配置
        </button>
        <button
          onClick={() => setTab('personnel')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            tab === 'personnel'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          人员管理
        </button>
      </div>

      {tab === 'phases' ? <PhaseConfig /> : <PersonnelManager />}
    </div>
  );
}
