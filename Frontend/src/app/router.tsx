import { createBrowserRouter, Navigate } from 'react-router-dom';
import { App } from './App';
import { AuthLayout } from '../features/auth/components/AuthLayout';
import { LoginPage } from '../features/auth/pages/LoginPage';
import { RegisterPage } from '../features/auth/pages/RegisterPage';
import { PublicOnlyRoute } from '../features/auth/components/PublicOnlyRoute';
import { ProtectedRoute } from '../features/auth/components/ProtectedRoute';
import { AuthenticatedShell } from '../features/dashboard/components/AuthenticatedShell';
import { DashboardPage } from '../features/dashboard/pages/DashboardPage';
import { ResumeListPage } from '../features/resumes/pages/ResumeListPage';
import { ResumeNewPage } from '../features/resumes/pages/ResumeNewPage';
import { ResumeDetailPage } from '../features/resumes/pages/ResumeDetailPage';
import { ResumeEditPage } from '../features/resumes/pages/ResumeEditPage';
import { JobListPage } from '../features/jobs/pages/JobListPage';
import { JobNewPage } from '../features/jobs/pages/JobNewPage';
import { JobDetailPage } from '../features/jobs/pages/JobDetailPage';
import { JobEditPage } from '../features/jobs/pages/JobEditPage';
import { NotFoundPage } from './NotFoundPage';
import { AnalysisListPage } from '../features/analyses/pages/AnalysisListPage';
import { AnalysisNewPage } from '../features/analyses/pages/AnalysisNewPage';
import { AnalysisDetailPage } from '../features/analyses/pages/AnalysisDetailPage';
import { InterviewPreparationListPage } from '../features/interview-preparations/pages/InterviewPreparationListPage';
import { InterviewPreparationNewPage } from '../features/interview-preparations/pages/InterviewPreparationNewPage';
import { InterviewPreparationDetailPage } from '../features/interview-preparations/pages/InterviewPreparationDetailPage';

export const router = createBrowserRouter([
  {
    element: <App />,
    children: [
      {
        element: <PublicOnlyRoute />,
        children: [
          {
            element: <AuthLayout />,
            children: [
              { path: '/', element: <Navigate to="/login" replace /> },
              { path: '/login', element: <LoginPage /> },
              { path: '/register', element: <RegisterPage /> },
            ],
          },
        ],
      },
      {
        element: <ProtectedRoute />,
        children: [
          {
            element: <AuthenticatedShell />,
            children: [
              { path: '/dashboard', element: <DashboardPage /> },
              { path: '/resumes', element: <ResumeListPage /> },
              { path: '/resumes/new', element: <ResumeNewPage /> },
              { path: '/resumes/:id', element: <ResumeDetailPage /> },
              { path: '/resumes/:id/edit', element: <ResumeEditPage /> },
              { path: '/jobs', element: <JobListPage /> },
              { path: '/jobs/new', element: <JobNewPage /> },
              { path: '/jobs/:id', element: <JobDetailPage /> },
              { path: '/jobs/:id/edit', element: <JobEditPage /> },
              { path: '/analyses', element: <AnalysisListPage /> },
              { path: '/analyses/new', element: <AnalysisNewPage /> },
              { path: '/analyses/:id', element: <AnalysisDetailPage /> },
              { path: '/interview-preparations', element: <InterviewPreparationListPage /> },
              { path: '/interview-preparations/new', element: <InterviewPreparationNewPage /> },
              { path: '/interview-preparations/:id', element: <InterviewPreparationDetailPage /> },
            ],
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
