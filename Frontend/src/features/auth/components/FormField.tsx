import type { ReactNode } from 'react';

export function FormField({ id, label, type = 'text', value, onChange, autoComplete, error, children }: { id: string; label: string; type?: string; value: string; onChange: (value: string) => void; autoComplete?: string; error?: string; children?: ReactNode }) {
  const errorId = `${id}-error`;
  return <div><label htmlFor={id} className="field-label">{label}</label><div className="relative mt-2"><input id={id} name={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} className="field-input" />{children}</div>{error && <p id={errorId} role="alert" className="mt-1.5 text-sm text-rose-600">{error}</p>}</div>;
}
