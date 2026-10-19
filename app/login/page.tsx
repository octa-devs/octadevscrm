'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import ThemeToggle from '@/components/ThemeToggle';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true); setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setError(error.message === 'Invalid login credentials' ? 'That email and password don\'t match an account.' : error.message); setLoading(false); return; }
    router.push('/dashboard'); router.refresh();
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-10">
      <div className="absolute right-5 top-5 z-10"><ThemeToggle /></div>

      <div className="w-full max-w-[380px]">
        {/* the mark */}
        <div className="mb-10 flex flex-col items-center text-center">
          <div className="relative grid h-[104px] w-[104px] place-items-center">
            <svg viewBox="0 0 104 104" className="draw-octagon absolute inset-0 h-full w-full" aria-hidden>
              <path
                d="M31.5 3.5 H72.5 L100.5 31.5 V72.5 L72.5 100.5 H31.5 L3.5 72.5 V31.5 Z"
                fill="none" stroke="currentColor" strokeWidth="1.25" className="text-dim" strokeLinejoin="round"
              />
            </svg>
            <img src="/logo.png" alt="OCTA DEVS" className="chamfer h-[54px] w-[54px] object-cover" />
          </div>
          <h1 className="mt-7 font-display text-[26px] font-semibold tracking-tightest leading-tight">OCTA DEVS</h1>
          <p className="mt-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-dim">Employee portal</p>
        </div>

        <form onSubmit={submit} className="card p-6 rise" style={{ animationDelay: '160ms' }} noValidate>
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="label">Email</label>
              <input id="email" className="field" type="email" autoComplete="email" placeholder="you@octadevs.fun" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <label htmlFor="password" className="label">Password</label>
              <input id="password" className="field" type="password" autoComplete="current-password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
          </div>

          {error && (
            <p className="mt-4 rounded-[10px] border border-danger/30 bg-danger/10 px-3 py-2.5 text-[13px] leading-snug text-danger">{error}</p>
          )}

          <button type="submit" className="btn btn-primary mt-6 w-full" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-5 text-center text-[12px] leading-relaxed text-dim">
          Access is granted by an administrator.
        </p>
      </div>
    </div>
  );
}
