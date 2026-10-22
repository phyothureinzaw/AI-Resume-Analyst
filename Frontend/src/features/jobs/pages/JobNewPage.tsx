import { useNavigate } from 'react-router-dom';
import { JobEditor } from '../components/JobEditor';
export function JobNewPage() { const navigate = useNavigate(); return <main className="page-shell"><div><p className="eyebrow">New job</p><h1 className="page-title">Add job</h1><p className="page-description">Save a job description for later matching.</p></div><section className="surface mt-8 p-6 sm:p-8"><JobEditor onSaved={(id) => navigate(`/jobs/${id}`)} /></section></main>; }
