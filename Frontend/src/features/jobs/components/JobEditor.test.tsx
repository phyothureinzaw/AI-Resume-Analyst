import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearCsrfToken } from '../../../shared/api/client';
import { JobEditor } from './JobEditor';

function renderEditor(onSaved = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <JobEditor onSaved={onSaved} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return onSaved;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('JobEditor', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    clearCsrfToken();
    vi.restoreAllMocks();
  });

  it('shows client validation errors without sending a request', () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    renderEditor();

    fireEvent.click(screen.getByRole('button', { name: 'Save job' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Enter a job title.');
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a job description.');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('gets CSRF, saves the job, and reports the saved id', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ csrfToken: 'test-csrf-token' }))
      .mockResolvedValueOnce(jsonResponse({ job: { id: '00000000-0000-0000-0000-000000000001' } }, 201));
    const onSaved = renderEditor();

    fireEvent.change(screen.getByLabelText('Job title'), { target: { value: 'Backend Engineer' } });
    fireEvent.change(screen.getByLabelText('Company'), { target: { value: 'Example Co' } });
    fireEvent.change(screen.getByLabelText('Job description'), { target: { value: 'Build reliable services.\nWork with SQL.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save job' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('00000000-0000-0000-0000-000000000001'));
  });

  it('preserves entered values and shows a sanitized API error', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ csrfToken: 'test-csrf-token' }))
      .mockResolvedValueOnce(jsonResponse({ error: { message: 'Unable to save this job.' } }, 500));
    renderEditor();

    fireEvent.change(screen.getByLabelText('Job title'), { target: { value: 'Data Engineer' } });
    fireEvent.change(screen.getByLabelText('Job description'), { target: { value: 'Keep this text after failure.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save job' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Unable to save this job.'));
    expect(screen.getByLabelText('Job title')).toHaveValue('Data Engineer');
    expect(screen.getByLabelText('Job description')).toHaveValue('Keep this text after failure.');
  });
});
