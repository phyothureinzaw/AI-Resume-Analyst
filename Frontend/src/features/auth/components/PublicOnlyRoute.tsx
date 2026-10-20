import { Navigate, Outlet } from 'react-router-dom';
import { ApiError } from '../../../shared/api/client';
import { useCurrentUser } from '../hooks/use-auth';
export function PublicOnlyRoute() { const query = useCurrentUser(); if (query.isPending) return <main className="flex min-h-screen items-center justify-center"><p className="text-sm text-slate-600" role="status">Checking your session…</p></main>; if (query.isSuccess) return <Navigate to="/dashboard" replace />; if (query.error && !(query.error instanceof ApiError && query.error.status === 401)) return <main className="flex min-h-screen items-center justify-center px-6"><p className="text-sm text-slate-600">We could not check your session. Try again shortly.</p></main>; return <Outlet />; }
