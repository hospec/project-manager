import { useParams } from 'react-router-dom';
import ProjectOverview from '../components/dashboard/ProjectOverview';

export default function DashboardPage() {
  const { id } = useParams();

  if (!id) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <p className="text-lg font-medium text-gray-500">请从左侧选择一个项目</p>
        <p className="text-sm mt-1">或点击左侧下拉菜单创建新项目</p>
      </div>
    );
  }

  return <ProjectOverview projectId={Number(id)} />;
}
