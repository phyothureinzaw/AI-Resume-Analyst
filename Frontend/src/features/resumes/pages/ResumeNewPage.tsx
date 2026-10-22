import { useNavigate } from 'react-router-dom';
import { ResumeEditor } from '../components/ResumeEditor';
export function ResumeNewPage() { const navigate = useNavigate(); return <main className="page-shell"><div><p className="eyebrow">New resume</p><h1 className="page-title">Add resume</h1><p className="page-description">Review the text carefully before saving it.</p></div><div className="surface mt-8 p-6 sm:p-8"><ResumeEditor onSaved={(id) => navigate(`/resumes/${id}`)} /></div></main>; }
