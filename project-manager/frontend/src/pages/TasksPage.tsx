import { useParams } from 'react-router-dom';
import TaskTablePage from '../components/tasks/TaskTablePage';

export default function TasksPage() {
  const { id } = useParams();
  if (!id) return null;
  return <TaskTablePage projectId={Number(id)} />;
}
