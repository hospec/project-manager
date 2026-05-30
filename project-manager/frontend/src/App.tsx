import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProjectProvider } from './context/ProjectContext';
import { Toaster } from 'sonner';
import AppShell from './components/layout/AppShell';
import DashboardPage from './pages/DashboardPage';
import TasksPage from './pages/TasksPage';
import CalendarPage from './pages/CalendarPage';
import IssuesPage from './pages/IssuesPage';
import NotesPage from './pages/NotesPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ProjectProvider>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="/" element={<Navigate to="/projects" replace />} />
              <Route path="/projects" element={<DashboardPage />} />
              <Route path="/projects/:id/dashboard" element={<DashboardPage />} />
              <Route path="/projects/:id/tasks" element={<TasksPage />} />
              <Route path="/projects/:id/calendar" element={<CalendarPage />} />
              <Route path="/projects/:id/issues" element={<IssuesPage />} />
              <Route path="/projects/:id/notes" element={<NotesPage />} />
            </Route>
          </Routes>
        </ProjectProvider>
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </QueryClientProvider>
  );
}
