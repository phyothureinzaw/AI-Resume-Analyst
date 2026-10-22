import { Link } from 'react-router-dom';
import { useCurrentUser } from '../../auth/hooks/use-auth';
import { useDashboard } from '../hooks/use-dashboard';
import type { DashboardStatus } from '../types';

const statuses: Array<{ key: DashboardStatus; label: string; className: string }> = [
  { key: 'pending', label: 'Pending', className: 'bg-amber-50 text-amber-800' },
  { key: 'processing', label: 'Processing', className: 'bg-blue-50 text-blue-800' },
  { key: 'completed', label: 'Completed', className: 'bg-emerald-50 text-emerald-800' },
  { key: 'failed', label: 'Failed', className: 'bg-rose-50 text-rose-800' }
];
function date(value: string) { return new Date(value).toLocaleDateString(); }
function statusLabel(status: DashboardStatus) { return statuses.find((item) => item.key === status)?.label ?? status; }

function EmptyCard({ title, message, to, action }: { title: string; message: string; to: string; action: string }) {
  return <div className="surface border-dashed"><h3 className="font-semibold text-slate-950">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{message}</p><Link to={to} className="button button-primary mt-4">{action}</Link></div>;
}

export function DashboardPage() {
  const user = useCurrentUser().data?.user;
  const query = useDashboard();
  const data = query.data?.dashboard;
  return <main className="page-shell">
    <div className="page-header"><div><p className="eyebrow">Workspace</p><h1 className="page-title">Dashboard</h1><p className="page-description">Welcome back{user?.fullName ? `, ${user.fullName}` : ''}. Here is your current workspace.</p></div><div className="page-header-actions"><Link to="/resumes/new" className="button button-secondary">Add resume</Link><Link to="/jobs/new" className="button button-secondary">Add job</Link><Link to="/analyses/new" className="button button-primary">New analysis</Link></div></div>
    {query.isPending && <p className="mt-10 text-sm text-slate-600" role="status">Loading dashboard…</p>}
    {query.isError && <div className="inline-error mt-10" role="alert"><p className="font-semibold">Unable to load dashboard</p><p className="mt-1">Your saved data is unchanged. Try again when the API is available.</p><button type="button" onClick={() => void query.refetch()} className="button button-secondary mt-4">Retry</button></div>}
    {query.isSuccess && data && <>
      <section aria-label="Workspace counts" className="mt-8 grid gap-4 sm:grid-cols-3">{[['Resumes', data.counts.resumes, '/resumes'], ['Jobs', data.counts.jobs, '/jobs'], ['Analyses', data.counts.analyses, '/analyses']].map(([label, count, to]) => <Link key={String(label)} to={String(to)} className="metric-card surface hover:border-blue-300"><p className="text-sm font-semibold text-slate-600">{label}</p><p className="mt-2 text-3xl font-bold leading-none text-slate-950">{count}</p></Link>)}</section>
      <section className="status-section surface mt-8" aria-labelledby="status-heading"><div className="flex items-center justify-between gap-3"><h2 id="status-heading" className="font-semibold text-slate-950">Analysis status</h2><Link to="/analyses" className="text-sm font-semibold text-blue-600 hover:text-blue-700">View history</Link></div><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{statuses.map((item) => <div key={item.key} className={`status-card ${item.className}`}><p className="text-xs font-semibold uppercase tracking-wide">{item.label}</p><p className="mt-1 text-2xl font-bold leading-none">{data.analysisStatuses[item.key]}</p></div>)}</div></section>
      <section className="mt-8" aria-labelledby="latest-heading"><div className="flex items-center justify-between gap-3"><h2 id="latest-heading" className="text-xl font-bold text-slate-950">Latest analyses</h2>{data.latestAnalyses.length > 0 && <Link to="/analyses" className="text-sm font-semibold text-blue-600 hover:text-blue-700">View all</Link>}</div>{data.latestAnalyses.length === 0 ? <div className="mt-4"><EmptyCard title="No analyses yet" message="Save a resume and a job description to start your first comparison." to="/analyses/new" action="Start an analysis" /></div> : <div className="surface mt-4 divide-y divide-slate-200 overflow-hidden p-0">{data.latestAnalyses.map((analysis) => <Link key={analysis.id} to={`/analyses/${analysis.id}`} className="block p-5 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"><div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><h3 className="truncate font-semibold text-slate-950">{analysis.resumeTitle}</h3><p className="mt-1 truncate text-sm text-slate-600">{analysis.jobTitle}{analysis.companyName ? ` · ${analysis.companyName}` : ''}</p></div><div className="flex shrink-0 items-center gap-3"><span className={`status-badge status-${analysis.status}`}>{statusLabel(analysis.status)}</span>{analysis.score !== null && <span className="text-sm font-semibold text-slate-700">{analysis.score}% match</span>}</div></div><p className="mt-3 text-xs text-slate-500">Created {date(analysis.createdAt)}{analysis.completedAt ? ` · Completed ${date(analysis.completedAt)}` : ''}</p></Link>)}</div>}
      <div className="mt-8 grid gap-4 md:grid-cols-2">{data.counts.resumes === 0 && <EmptyCard title="No resumes saved" message="Add a resume by pasting text or reviewing extracted PDF text." to="/resumes/new" action="Add resume" />}{data.counts.jobs === 0 && <EmptyCard title="No jobs saved" message="Add a job description before starting a comparison." to="/jobs/new" action="Add job" />}</div>
    </section></>}
  </main>;
}
