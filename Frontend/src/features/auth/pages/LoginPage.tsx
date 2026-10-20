import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '../../../shared/api/client';
import { useAuthMutations } from '../hooks/use-auth';
import { loginFormSchema, type LoginForm } from '../schemas';
import { FormField } from '../components/FormField';
import { PasswordField } from '../components/PasswordField';

export function LoginPage() {
  const navigate = useNavigate(); const location = useLocation(); const { signIn } = useAuthMutations();
  const [form, setForm] = useState<LoginForm>({ email: '', password: '' }); const [errors, setErrors] = useState<Record<string, string>>({});
  const notice = (location.state as { notice?: string } | null)?.notice;
  const submit = async (event: React.FormEvent) => { event.preventDefault(); const parsed = loginFormSchema.safeParse(form); if (!parsed.success) { setErrors(Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message]))); return; } setErrors({}); try { await signIn.mutateAsync(parsed.data); const from = (location.state as { from?: string } | null)?.from; navigate(from && from.startsWith('/') && !from.startsWith('//') && !['/login', '/register'].includes(from) ? from : '/dashboard', { replace: true }); } catch (error) { setErrors({ form: error instanceof ApiError && error.status === 401 ? 'Email or password is incorrect.' : error instanceof ApiError ? error.message : 'Unable to sign in right now.' }); } };
  return <><h1 className="text-2xl font-bold tracking-tight text-slate-950">Sign in</h1><p className="mt-2 text-sm text-slate-600">Use your Resume Match account.</p>{notice && <p role="status" className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</p>}<form onSubmit={submit} className="mt-7 space-y-5" noValidate>{errors.form && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{errors.form}</p>}<FormField id="email" label="Email" value={form.email} onChange={(email) => setForm({ ...form, email })} autoComplete="email" error={errors.email} /><PasswordField id="password" label="Password" value={form.password} onChange={(password) => setForm({ ...form, password })} autoComplete="current-password" error={errors.password} /><button disabled={signIn.isPending} className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60">{signIn.isPending ? 'Signing in…' : 'Sign in'}</button></form><p className="mt-6 text-center text-sm text-slate-600">Don’t have an account? <Link to="/register" className="font-semibold text-blue-600 hover:underline">Create account</Link></p></>;
}
