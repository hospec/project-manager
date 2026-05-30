import { useParams } from 'react-router-dom';
import IssueListPage from '../components/issues/IssueListPage';

export default function IssuesPage() {
  const { id } = useParams();
  if (!id) return null;
  return <IssueListPage projectId={Number(id)} />;
}
