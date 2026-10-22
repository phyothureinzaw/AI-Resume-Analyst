import { Link, Outlet } from 'react-router-dom';

export function AuthLayout() {
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-6">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50 md:grid-cols-[.8fr_1.2fr]">
        <div className="hidden bg-slate-950 p-10 text-white md:block">
          <Link to="/login" className="app-brand text-white"><span className="app-brand-mark">RM</span>Resume Match</Link>
          <div className="mt-28">
            <p className="eyebrow text-blue-300">Private workspace</p>
            <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight">A clearer way to prepare.</h1>
            <p className="mt-5 max-w-xs text-sm leading-7 text-slate-300">Keep resumes, job descriptions, and grounded comparisons in one focused place.</p>
          </div>
        </div>
        <div className="p-7 sm:p-10">
          <div className="mb-8 md:hidden"><Link to="/login" className="app-brand"><span className="app-brand-mark">RM</span>Resume Match</Link></div>
          <Outlet />
        </div>
      </div>
    </main>
  );
}
