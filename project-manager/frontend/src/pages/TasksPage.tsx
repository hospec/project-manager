import { useParams } from 'react-router-dom';
import TaskListPage from '../components/tasks/TaskListPage';

export default function TasksPage() {
  const { id } = useParams();
  if (!id) return null;
  return <TaskListPage projectId={Number(id)} />;
}
