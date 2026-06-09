'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';

import { Button } from '@/components/ui/button';

type Mode = 'login' | 'register';

export function AuthPanel() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError(null);
    setLoading(true);

    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(mode === 'login' ? { email, password } : { name, email, password }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(body.error || 'Authentication failed.');
      }

      window.location.href = searchParams.get('next') || '/';
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl rounded-[2.4rem] border border-[color:var(--line)] bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-6 shadow-[0_28px_90px_rgba(0,0,0,0.24)] sm:p-8">
      <div className="flex gap-2 rounded-full border border-white/10 bg-black/20 p-1 text-sm">
        <button className={`flex-1 rounded-full px-4 py-2 ${mode === 'login' ? 'bg-white/10 text-white' : 'text-[color:var(--muted)]'}`} onClick={() => setMode('login')} type="button">
          تسجيل الدخول
        </button>
        <button className={`flex-1 rounded-full px-4 py-2 ${mode === 'register' ? 'bg-white/10 text-white' : 'text-[color:var(--muted)]'}`} onClick={() => setMode('register')} type="button">
          إنشاء حساب
        </button>
      </div>

      <div className="mt-6 space-y-4">
        {mode === 'register' ? (
          <label className="block space-y-2">
            <span className="text-sm text-[color:var(--muted)]">الاسم</span>
            <input className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none" onChange={(event) => setName(event.target.value)} value={name} />
          </label>
        ) : null}

        <label className="block space-y-2">
          <span className="text-sm text-[color:var(--muted)]">البريد الإلكتروني</span>
          <input className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none" onChange={(event) => setEmail(event.target.value)} type="email" value={email} />
        </label>

        <label className="block space-y-2">
          <span className="text-sm text-[color:var(--muted)]">كلمة المرور</span>
          <input className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none" onChange={(event) => setPassword(event.target.value)} type="password" value={password} />
        </label>

        {error ? <p className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</p> : null}

        <Button className="w-full" disabled={loading} onClick={submit} size="lg" type="button">
          {loading ? 'جارٍ المتابعة…' : mode === 'login' ? 'ادخل إلى حسابك' : 'أنشئ الحساب'}
        </Button>
      </div>
    </div>
  );
}
