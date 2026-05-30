import { useParams } from 'react-router-dom';
import CalendarView from '../components/calendar/CalendarPage';

export default function CalendarPage() {
  const { id } = useParams();
  if (!id) return null;
  return <CalendarView projectId={Number(id)} />;
}
