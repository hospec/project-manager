import { useParams } from 'react-router-dom';
import NotesPageComponent from '../components/notes/NotesPage';

export default function NotesPage() {
  const { id } = useParams();
  if (!id) return null;
  return <NotesPageComponent projectId={Number(id)} />;
}
