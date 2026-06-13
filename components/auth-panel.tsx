'use client';

import { useState } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { messages } from '@/lib/messages';

type Mode = 'login' | 'register';

export function AuthPanel() {
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showRegisterNotice, setShowRegisterNotice] = useState(false);

  async function submit() {
    if (mode === 'register') {
      setShowRegisterNotice(true);
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const endpoint = '/api/auth/login';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(body.error || 'Authentication failed.');
      }

      const next = new URLSearchParams(window.location.search).get('next');
      window.location.href = next || '/';
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="mx-auto max-w-xl rounded-[2.4rem] border border-[color:var(--line)] bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-6 shadow-[0_28px_90px_rgba(0,0,0,0.24)] sm:p-8">
        <div className="flex gap-2 rounded-full border border-white/10 bg-black/20 p-1 text-sm">
          <button className={`flex-1 rounded-full px-4 py-2 ${mode === 'login' ? 'bg-white/10 text-white' : 'text-[color:var(--muted)]'}`} onClick={() => setMode('login')} type="button">
            {messages.authPanel.loginTab}
          </button>
          <button className={`flex-1 rounded-full px-4 py-2 ${mode === 'register' ? 'bg-white/10 text-white' : 'text-[color:var(--muted)]'}`} onClick={() => setMode('register')} type="button">
            {messages.authPanel.registerTab}
          </button>
        </div>

        <div className="mt-6 space-y-4">
          {mode === 'register' ? (
            <label className="block space-y-2">
              <span className="text-sm text-[color:var(--muted)]">{messages.authPanel.name}</span>
              <input className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none" onChange={(event) => setName(event.target.value)} value={name} />
            </label>
          ) : null}

          <label className="block space-y-2">
            <span className="text-sm text-[color:var(--muted)]">{messages.authPanel.email}</span>
            <input className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none" onChange={(event) => setEmail(event.target.value)} type="email" value={email} />
          </label>

          <label className="block space-y-2">
            <span className="text-sm text-[color:var(--muted)]">{messages.authPanel.password}</span>
            <input className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none" onChange={(event) => setPassword(event.target.value)} type="password" value={password} />
          </label>

          {error ? <p className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</p> : null}

          <Button className="w-full" disabled={loading} onClick={submit} size="lg" type="button">
            {loading ? messages.authPanel.loading : mode === 'login' ? messages.authPanel.loginSubmit : messages.authPanel.registerSubmit}
          </Button>
        </div>
      </div>

      {showRegisterNotice ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="register-contact-title">
          <div className="relative w-full max-w-sm rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(17,24,39,0.98),rgba(10,14,22,0.98))] p-6 text-right shadow-[0_28px_90px_rgba(0,0,0,0.45)]">
            <button aria-label={messages.authPanel.registerContactClose} className="absolute left-4 top-4 rounded-full border border-white/10 bg-white/5 p-2 text-white/80 transition hover:bg-white/10 hover:text-white" onClick={() => setShowRegisterNotice(false)} type="button">
              <X className="size-4" />
            </button>

            <div className="mb-4 inline-flex size-14 items-center justify-center rounded-full border border-[color:var(--line)] bg-[rgba(193,168,106,0.12)] text-[color:var(--accent)]">
              <WhatsAppLogo className="size-7" />
            </div>
            <h2 className="text-xl font-semibold text-white" id="register-contact-title">
              {messages.authPanel.registerContactTitle}
            </h2>
            <p className="mt-3 text-sm leading-7 text-[color:var(--muted)]">{messages.authPanel.registerContactNotice}</p>

            <Link className="mt-6 inline-flex w-full items-center justify-center gap-3 rounded-full bg-[linear-gradient(135deg,var(--accent),var(--accent-strong))] px-5 py-3 text-sm font-medium text-[color:var(--accent-ink)] shadow-[0_20px_60px_rgba(193,168,106,0.18)] transition hover:translate-y-[-1px] hover:brightness-105" href="https://wa.me/966507863400" rel="noreferrer" target="_blank">
              <WhatsAppLogo className="size-5" />
              <span dir="ltr">966507863400</span>
            </Link>

            <Button className="mt-3 w-full" onClick={() => setShowRegisterNotice(false)} type="button" variant="secondary">
              {messages.authPanel.registerContactClose}
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}

function WhatsAppLogo({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M19.05 4.91A9.82 9.82 0 0 0 12.03 2C6.61 2 2.2 6.41 2.2 11.83c0 1.73.45 3.43 1.32 4.93L2 22l5.39-1.41a9.8 9.8 0 0 0 4.64 1.18h.01c5.42 0 9.83-4.41 9.83-9.83a9.76 9.76 0 0 0-2.82-7.03Zm-7.02 15.2h-.01a8.16 8.16 0 0 1-4.16-1.14l-.3-.18-3.2.84.85-3.12-.2-.32a8.16 8.16 0 0 1-1.26-4.35c0-4.5 3.66-8.16 8.17-8.16 2.18 0 4.23.85 5.77 2.39a8.12 8.12 0 0 1 2.39 5.77c0 4.5-3.67 8.17-8.05 8.17Zm4.47-6.12c-.24-.12-1.4-.69-1.62-.77-.22-.08-.38-.12-.54.12-.16.24-.62.77-.76.93-.14.16-.28.18-.52.06-.24-.12-1.02-.38-1.94-1.22-.72-.64-1.2-1.43-1.34-1.67-.14-.24-.01-.37.11-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.2-.48-.4-.41-.54-.42l-.46-.01c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.7 2.6 4.12 3.65.58.25 1.03.4 1.38.52.58.18 1.1.16 1.52.1.46-.07 1.4-.57 1.6-1.12.2-.55.2-1.02.14-1.12-.06-.1-.22-.16-.46-.28Z" />
    </svg>
  );
}
