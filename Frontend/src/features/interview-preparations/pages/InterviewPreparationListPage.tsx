import { Link, useSearchParams } from 'react-router-dom';
import { useInterviewPreparationList } from '../hooks/use-interview-preparations';
import type { InterviewPreparationStatus } from '../types';

const statuses: Array<{ value: InterviewPreparationStatus; label: string }> = [
  { value: 'pending', label: 'Pending' }, { value: 'processing', label: 'Processing' }, { value: 'completed', label: 'Completed' }, { value: 'failed', label: 'Failed' }
];

function date(value: string) { return new Date(value).toLocaleDateString(); }
function statusLabel(status: InterviewPreparationStatus) { return status === 'processing' ? 'Preparing' : status.charAt(0).toUpperCase() + status.slice(1); }

export function InterviewPreparationListPage() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1);
  const status = (params.get('status') || undefined) as InterviewPreparationStatus | undefined;
  const query = useInterviewPreparationList(page, 10, status);
  const setFilter = (value: string) => setParams(value ? { status: value, page: '1' } : { page: '1' });
  return <main className="page-shell">
    <div className="page-header"><div><p className="eyebrow">Practice library</p><h1 className="page-title">Interview preparations</h1><p className="page-description">Review generated practice questions and preparation notes from your saved job selections.</p></div><Link to="/interview-preparations/new" className="button button-primary">New preparation</Link></div>
    <div className="mt-8 max-w-xs"><label htmlFor="interview-status" className="field-label">Filter by status</label><select id="interview-status" className="field-select" value={status ?? ''} onChange={(event) => setFilter(event.target.value)}><option value="">All statuses</option>{statuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
    {query.isPending && <p className="mt-8" role="status">Loading interview preparations…</p>}
    {query.isError && <div className="inline-error mt-8" role="alert"><p>Unable to load interview preparations right now.</p><button type="button" className="button button-secondary mt-3" onClick={() => void query.refetch()}>Try again</button></div>}
    {query.isSuccess && query.data.items.length === 0 && <div className="surface mt-8 p-8 text-center"><p className="font-semibold text-slate-950">{status ? 'No preparations match this filter' : 'No interview preparations yet'}</p><p className="mt-2 text-sm text-slate-600">{status ? 'Try another status or clear the filter.' : 'Choose a saved job description to create your first preparation.'}</p>{!status && <Link to="/interview-preparations/new" className="button button-primary mt-5">Create preparation</Link>}</div>}
    {query.isSuccess && query.data.items.length > 0 && <>
      <div className="surface mt-8 divide-y divide-slate-200 overflow-hidden p-0">{query.data.items.map((item) => <Link key={item.id} to={`/interview-preparations/${item.id}`} className="block p-5 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"><div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><h2 className="break-words font-semibold text-slate-950">{item.jobTitle}</h2><p className="mt-1 break-words text-sm text-slate-600">{item.companyName ?? 'Company not specified'} · {item.resumeTitle ?? 'General preparation'}</p></div><span className={`status-badge status-${item.status}`}>{statusLabel(item.status)}</span></div><p className="mt-3 text-xs text-slate-500">Created {date(item.createdAt)}{item.completedAt ? ` · Completed ${date(item.completedAt)}` : ''}</p></Link>)}</div>
      <div className="mt-5 flex items-center justify-between gap-3"><button type="button" className="button button-secondary" disabled={page <= 1} onClick={() => setParams({ page: String(page - 1), ...(status ? { status } : {}) })}>Previous</button><span className="text-sm text-slate-600">Page {query.data.pagination.page} of {Math.max(1, query.data.pagination.totalPages)}</span><button type="button" className="button button-secondary" disabled={page >= query.data.pagination.totalPages} onClick={() => setParams({ page: String(page + 1), ...(status ? { status } : {}) })}>Next</button></div>
    </>}
  </main>;
}
