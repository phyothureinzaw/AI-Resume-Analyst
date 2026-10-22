import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuthMutations, useCurrentUser } from '../../auth/hooks/use-auth';

const navigation = [
  { to: '/dashboard', label: 'Dashboard', icon: '⌂' },
  { to: '/resumes', label: 'Resumes', icon: '▤' },
  { to: '/jobs', label: 'Jobs', icon: '▣' },
  { to: '/analyses', label: 'Analyses', icon: '◌' }
  ,{ to: '/interview-preparations', label: 'Interview Prep', icon: '✦' }
];

export function AuthenticatedShell() {
  const user = useCurrentUser().data?.user;
  const { signOut } = useAuthMutations();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const drawer = useRef<HTMLElement>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); menuButton.current?.focus(); } };
    document.addEventListener('keydown', onKeyDown);
    drawer.current?.querySelector<HTMLElement>('a, button')?.focus();
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const logout = async () => {
    setError('');
    try { await signOut.mutateAsync(); navigate('/login', { replace: true, state: { notice: 'You have been signed out.' } }); }
    catch { setError('Unable to sign out. Please try again.'); }
  };
  const closeOnNavigate = () => { setOpen(false); menuButton.current?.focus(); };
  const nav = <nav className="app-nav" aria-label="Primary navigation">{navigation.map((item) => <NavLink key={item.to} to={item.to} end={item.to === '/dashboard'} className="app-nav-link" onClick={closeOnNavigate}><span className="app-nav-icon" aria-hidden="true">{item.icon}</span>{item.label}</NavLink>)}</nav>;
  return <div className="app-shell">
    <header className="mobile-header"><Link to="/dashboard" className="app-brand"><span className="app-brand-mark" aria-hidden="true">RM</span>Resume Match</Link><button ref={menuButton} type="button" className="mobile-menu-button" aria-label="Open navigation" aria-expanded={open} aria-controls="primary-sidebar" onClick={() => setOpen(true)}>☰</button></header>
    {open && <button type="button" className="drawer-backdrop" aria-label="Close navigation" onClick={() => { setOpen(false); menuButton.current?.focus(); }} />}
    <aside id="primary-sidebar" ref={drawer} className="app-sidebar" data-open={open} aria-label="Application navigation">
      <Link to="/dashboard" className="app-brand" onClick={closeOnNavigate}><span className="app-brand-mark" aria-hidden="true">RM</span>Resume Match</Link>
      {nav}
      <div className="app-account"><p className="app-account-name">{user?.fullName}</p><p className="app-account-email">{user?.email}</p><button type="button" className="button button-secondary app-signout" onClick={() => void logout()} disabled={signOut.isPending}>{signOut.isPending ? 'Signing out…' : 'Sign out'}</button></div>
    </aside>
    <div className="app-main">{error && <p role="alert" className="mx-auto max-w-5xl px-6 pt-4 text-sm text-rose-600">{error}</p>}<Outlet /></div>
  </div>;
}
