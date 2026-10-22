import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError } from '../../../shared/api/client';
import { useJobList } from '../../jobs/hooks/use-jobs';
import { useResumeList } from '../../resumes/hooks/use-resumes';
import { useInterviewPreparationCreation } from '../hooks/use-interview-preparations';

function apiMessage(error: unknown): string { if (error instanceof ApiError && error.status === 429) return 'You already have the maximum number of active preparations. Wait for one to finish before starting another.'; if (error instanceof ApiError && error.status === 401) return 'Your session has expired. Sign in again to continue.'; if (error instanceof ApiError && error.status === 400) return 'Check the selected sources and try again.'; return error instanceof Error ? error.message : 'Unable to start preparation. You can retry the same operation safely.'; }

export function InterviewPreparationNewPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [jobSearch, setJobSearch] = useState('');
  const [resumeSearch, setResumeSearch] = useState('');
  const [jobId, setJobId] = useState(params.get('jobId') ?? '');
  const [resumeId, setResumeId] = useState(params.get('resumeId') ?? '');
  const [requestId, setRequestId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const jobs = useJobList(1, 10, jobSearch);
  const resumes = useResumeList(1, 10, resumeSearch);
  const create = useInterviewPreparationCreation();
  const selectedJob = jobs.data?.items.find((item) => item.id === jobId);
  const selectedResume = resumes.data?.items.find((item) => item.id === resumeId);
  const chooseJob = (value: string) => { setJobId(value); setRequestId(null); setError(''); };
  const chooseResume = (value: string) => { setResumeId(value); setRequestId(null); setError(''); };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); if (!jobId) { setError('Choose a job description before generating preparation.'); return; }
    const nextRequestId = requestId ?? crypto.randomUUID(); setRequestId(nextRequestId);
    try { const data = await create.mutateAsync({ jobDescriptionId: jobId, resumeId: resumeId || null, requestId: nextRequestId }); navigate(`/interview-preparations/${data.preparationId}`); }
    catch (requestError) { setError(apiMessage(requestError)); }
  };
  return <main className="page-shell">
    <Link to="/interview-preparations" className="text-sm font-semibold text-blue-600">← Back to preparations</Link>
    <div className="mt-6"><p className="eyebrow">Interview practice</p><h1 className="page-title">Interview preparation</h1><p className="page-description">Choose a saved job and optionally a resume to create grounded practice material.</p></div>
    <form onSubmit={submit} className="surface mt-8 space-y-7 p-6 sm:p-8">
      <div><label htmlFor="preparation-job-search" className="field-label">Search job descriptions</label><input id="preparation-job-search" className="field-input" value={jobSearch} onChange={(event) => setJobSearch(event.target.value)} placeholder="Search by title or company" /><label htmlFor="preparation-job" className="field-label mt-4">Job description <span aria-hidden="true">*</span></label><select id="preparation-job" required className="field-select" value={jobId} onChange={(event) => chooseJob(event.target.value)}><option value="">Select a job description</option>{jobs.data?.items.map((item) => <option key={item.id} value={item.id}>{item.jobTitle}{item.companyName ? ` · ${item.companyName}` : ''}</option>)}</select>{jobs.isPending && <p className="mt-2 text-sm text-slate-500" role="status">Loading job descriptions…</p>}{jobs.isError && <p className="mt-2 text-sm text-rose-600" role="alert">Unable to load job descriptions.</p>}{selectedJob && <p className="mt-2 text-sm text-slate-600">Selected: <Link className="font-semibold text-blue-600" to={`/jobs/${selectedJob.id}`} target="_blank" rel="noreferrer">{selectedJob.jobTitle}</Link></p>}</div>
      <div><label htmlFor="preparation-resume-search" className="field-label">Search resumes <span className="font-normal text-slate-500">(optional)</span></label><input id="preparation-resume-search" className="field-input" value={resumeSearch} onChange={(event) => setResumeSearch(event.target.value)} placeholder="Search by title" /><label htmlFor="preparation-resume" className="field-label mt-4">Resume</label><select id="preparation-resume" className="field-select" value={resumeId} onChange={(event) => chooseResume(event.target.value)}><option value="">No resume — use general examples</option>{resumes.data?.items.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select>{resumes.isPending && <p className="mt-2 text-sm text-slate-500" role="status">Loading resumes…</p>}{resumes.isError && <p className="mt-2 text-sm text-rose-600" role="alert">Unable to load resumes.</p>}{selectedResume && <p className="mt-2 text-sm text-slate-600">Selected: <Link className="font-semibold text-blue-600" to={`/resumes/${selectedResume.id}`} target="_blank" rel="noreferrer">{selectedResume.title}</Link></p>}</div>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600"><p>Job-only mode produces general sample answers. Selecting a resume can personalize answers using supported experience from that saved snapshot.</p><p className="mt-2">When generation starts, the selected document text is sent to Gemini for processing. Nothing is sent before you choose Generate preparation.</p></div>
      {error && <p role="alert" className="inline-error">{error}</p>}
      <div className="flex flex-wrap gap-3"><button type="submit" disabled={create.isPending} className="button button-primary">{create.isPending ? 'Generating…' : requestId && error ? 'Retry generation' : 'Generate preparation'}</button><Link to="/interview-preparations" className="button button-secondary">Cancel</Link></div>
    </form>
  </main>;
}
