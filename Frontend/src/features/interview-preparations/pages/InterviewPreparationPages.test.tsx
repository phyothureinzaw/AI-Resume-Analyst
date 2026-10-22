import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearCsrfToken } from '../../../shared/api/client';
import { InterviewPreparationNewPage } from './InterviewPreparationNewPage';
import { InterviewPreparationDetailPage } from './InterviewPreparationDetailPage';

function response(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }); }
function renderWithClient(ui: React.ReactNode, initialEntries: string[] = ['/']) { const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter></QueryClientProvider>); }
function fixtureResult() {
  const questions = Array.from({ length: 12 }, (_, index) => ({ id: `q-${String(index + 1).padStart(3, '0')}`, category: index < 5 ? 'technical' : index < 9 ? 'scenario' : 'behavioral', question: `Question ${index + 1}`, jobSourceSegmentIds: ['job-001'], whyRelevant: 'Relevant to the role.', answerMode: index < 5 ? 'general_example' : index < 9 ? 'star_template' : 'resume_grounded', sampleAnswer: index < 5 ? 'A general sample.' : index < 9 ? 'Situation: [specific situation]. Action: [your action]. Result: [measurable result].' : 'Use the supported resume example.', keyPoints: ['Explain the approach'], followUpQuestion: 'What would you improve?', resumeSourceSegmentIds: index >= 9 ? ['resume-001'] : [] }));
  return { summary: 'A concise preparation summary.', questions, studyTopics: [{ topic: 'Core role skills', questionIds: ['q-001', 'q-002'] }], interviewerQuestions: ['What does success look like?', 'How is the team structured?', 'What are the first priorities?', 'What are the next steps?'] };
}

describe('interview preparation pages', () => {
  afterEach(() => { cleanup(); clearCsrfToken(); vi.restoreAllMocks(); });

  it('requires a job, supports no-resume selection, and prevents duplicate submissions', async () => {
    let resolveCreate!: (value: Response) => void;
    const createResponse = new Promise<Response>((resolve) => { resolveCreate = resolve; });
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/jobs?')) return response({ items: [{ id: 'job-1', jobTitle: 'Support specialist', companyName: 'Example', createdAt: '', updatedAt: '' }], pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 } });
      if (url.includes('/resumes?')) return response({ items: [], pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 } });
      if (url.endsWith('/auth/csrf')) return response({ csrfToken: 'csrf' });
      if (url.endsWith('/interview-preparations')) return createResponse;
      throw new Error(`unexpected request ${url}`);
    });
    renderWithClient(<Routes><Route path="/interview-preparations/new" element={<InterviewPreparationNewPage />} /><Route path="/interview-preparations/:id" element={<p>detail</p>} /></Routes>, ['/interview-preparations/new']);
    await waitFor(() => expect(screen.getByRole('option', { name: 'Support specialist · Example' })).toBeInTheDocument());
    fireEvent.submit(screen.getByRole('button', { name: 'Generate preparation' }).closest('form')!);
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a job description');
    fireEvent.change(screen.getByRole('combobox', { name: 'Job description' }), { target: { value: 'job-1' } });
    const submitButton = screen.getByRole('button', { name: 'Generate preparation' });
    fireEvent.click(submitButton);
    await waitFor(() => expect(fetchMock.mock.calls.filter(([input]) => String(input).endsWith('/interview-preparations')).length).toBe(1));
    fireEvent.click(submitButton);
    expect(fetchMock.mock.calls.filter(([input]) => String(input).endsWith('/interview-preparations')).length).toBe(1);
    resolveCreate(response({ preparationId: 'prep-1', status: 'pending' }, 202));
    await waitFor(() => expect(screen.getByText('detail')).toBeInTheDocument());
  });

  it('polls pending/processing detail and renders all categories and answer modes', async () => {
    const preparation = { id: 'prep-1', jobDescriptionId: 'job-1', resumeId: 'resume-1', jobTitle: 'Support specialist', companyName: 'Example', resumeTitle: 'Resume', status: 'completed', createdAt: '2026-01-01T00:00:00.000Z', completedAt: '2026-01-01T00:01:00.000Z', result: fixtureResult(), error: null };
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(response({ preparation }));
    renderWithClient(<Routes><Route path="/interview-preparations/:id" element={<InterviewPreparationDetailPage />} /></Routes>, ['/interview-preparations/prep-1']);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Support specialist' })).toBeInTheDocument());
    expect(screen.getByRole('heading', { name: 'Technical / role knowledge' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Practical scenarios' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Behavioral' })).toBeInTheDocument();
    expect(screen.getAllByText(/Question \d+/)).toHaveLength(12);
    fireEvent.click(screen.getAllByRole('button', { name: 'Show answer guidance' })[0]!);
    expect(screen.getByText('A general sample.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Hide answer guidance' })).toHaveAttribute('aria-expanded', 'true');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
