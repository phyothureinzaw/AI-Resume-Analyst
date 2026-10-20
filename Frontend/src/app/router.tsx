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
import { NotFoundPage } from './NotFoundPage';

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
            ],
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
