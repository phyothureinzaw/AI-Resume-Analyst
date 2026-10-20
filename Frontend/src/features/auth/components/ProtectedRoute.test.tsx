import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ProtectedRoute } from './ProtectedRoute';
import { AuthenticatedShell } from '../../dashboard/components/AuthenticatedShell';
import { authQueryKey } from '../hooks/use-auth';

function renderWithClient(ui: React.ReactNode, client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) { return { client, ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>) }; }

describe('frontend authentication behavior', () => {
  it('shows a deliberate loading state while checking the session', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => undefined)));
    renderWithClient(<MemoryRouter initialEntries={['/dashboard']}><Routes><Route element={<ProtectedRoute />}><Route path="/dashboard" element={<p>private</p>} /></Route></Routes></MemoryRouter>);
    expect(screen.getByRole('status')).toHaveTextContent('Checking your session');
  });

  it('redirects unauthenticated users away from protected routes', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { code: 'AUTHENTICATION_REQUIRED', message: 'Authentication required' } }), { status: 401, headers: { 'Content-Type': 'application/json' } })));
    renderWithClient(<MemoryRouter initialEntries={['/dashboard']}><Routes><Route element={<ProtectedRoute />}><Route path="/dashboard" element={<p>private</p>} /></Route><Route path="/login" element={<p>login</p>} /></Routes></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('login')).toBeInTheDocument());
    expect(screen.queryByText('private')).not.toBeInTheDocument();
  });

  it('clears the current-user query after a successful logout', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(authQueryKey, { user: { id: '1', fullName: 'Asha Lin', email: 'asha@example.com', createdAt: '2026-01-01T00:00:00.000Z' } });
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => { const url = String(input); if (url.endsWith('/auth/csrf')) return new Response(JSON.stringify({ csrfToken: 'csrf' }), { status: 200, headers: { 'Content-Type': 'application/json' } }); return new Response(null, { status: 204 }); }));
    renderWithClient(<MemoryRouter><Routes><Route path="/" element={<AuthenticatedShell />} /></Routes></MemoryRouter>, client);
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(client.getQueryData(authQueryKey)).toBeUndefined());
  });
});
