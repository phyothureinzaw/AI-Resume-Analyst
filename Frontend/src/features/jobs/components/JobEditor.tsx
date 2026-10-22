import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../../../shared/api/client';
import type { Job } from '../types';
import { useJobMutations } from '../hooks/use-jobs';

export function JobEditor({ job, onSaved }: { job?: Job; onSaved: (id: string) => void }) {
  const [jobTitle, setJobTitle] = useState(job?.jobTitle ?? '');
  const [companyName, setCompanyName] = useState(job?.companyName ?? '');
  const [descriptionText, setDescriptionText] = useState(job?.descriptionText ?? '');
  const [errors, setErrors] = useState<string[]>([]);
  const { create, update } = useJobMutations();
  useEffect(() => { if (job) { setJobTitle(job.jobTitle); setCompanyName(job.companyName ?? ''); setDescriptionText(job.descriptionText); } }, [job]);
  const submit = async (event: React.FormEvent) => { event.preventDefault(); const next: string[] = []; if (!jobTitle.trim()) next.push('Enter a job title.'); if (jobTitle.trim().length > 150) next.push('Job title must be 150 characters or fewer.'); if (companyName.trim().length > 150) next.push('Company name must be 150 characters or fewer.'); if (!descriptionText.trim()) next.push('Enter a job description.'); if (descriptionText.length > 100_000) next.push('Job description must be 100,000 characters or fewer.'); if (next.length) { setErrors(next); return; } setErrors([]); try { const input = { jobTitle: jobTitle.trim(), companyName: companyName.trim() || null, descriptionText }; const saved = job ? await update.mutateAsync({ id: job.id, input }) : await create.mutateAsync(input); onSaved(saved.job.id); } catch (error) { setErrors([error instanceof ApiError || error instanceof Error ? error.message : 'Unable to save this job right now.']); } };
  const pending = create.isPending || update.isPending;
  return <form onSubmit={submit} className="space-y-6" noValidate><div><label htmlFor="job-title" className="field-label">Job title</label><input id="job-title" value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} maxLength={150} className="field-input" /></div><div><label htmlFor="company-name" className="field-label">Company</label><input id="company-name" value={companyName} onChange={(event) => setCompanyName(event.target.value)} maxLength={150} className="field-input" /></div><div><label htmlFor="job-description" className="field-label">Job description</label><textarea id="job-description" value={descriptionText} onChange={(event) => setDescriptionText(event.target.value)} rows={20} className="field-textarea font-mono text-sm" /><p className="mt-1 text-right text-xs text-slate-500">{descriptionText.length.toLocaleString()} / 100,000 characters</p></div>{errors.length > 0 && <div role="alert" className="inline-error"><ul className="list-disc space-y-1 pl-5">{errors.map((error) => <li key={error}>{error}</li>)}</ul></div>}<div className="flex flex-wrap gap-3"><button type="submit" disabled={pending} className="button button-primary">{pending ? 'Saving…' : 'Save job'}</button><Link to={job ? `/jobs/${job.id}` : '/jobs'} className="button button-secondary">Cancel</Link></div></form>;
}
