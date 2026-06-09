'use client';

import { useEffect, useState } from 'react';
import { CreditCard, Loader2, PlusCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { formatDateTime, formatEventLabel } from '@/lib/locale';
import { messages } from '@/lib/messages';

export type WalletEvent = {
  id: string;
  jobId?: string;
  eventType: string;
  creditDelta: number;
  createdAt: string;
};

type WalletPayload = {
  balance: number;
  events: WalletEvent[];
};

export function WalletPanel({ refreshKey = 0 }: { refreshKey?: number }) {
  const walletMessages = messages.walletPanel;
  const [wallet, setWallet] = useState<WalletPayload | null>(null);
  const [amount, setAmount] = useState('5');
  const [isLoading, setIsLoading] = useState(true);
  const [isToppingUp, setIsToppingUp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadWallet() {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/wallet');
      const body = (await response.json()) as WalletPayload & { error?: string };
      if (!response.ok) {
        throw new Error(body.error || walletMessages.loadError);
      }
      setWallet({ balance: body.balance, events: body.events ?? [] });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : walletMessages.loadError);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadWallet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  async function topUp() {
    setIsToppingUp(true);
    setError(null);
    try {
      const response = await fetch('/api/wallet/top-up', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ amount: Number(amount) }),
      });
      const body = (await response.json()) as WalletPayload & { error?: string };
      if (!response.ok) {
        throw new Error(body.error || walletMessages.topUpError);
      }
      setWallet({ balance: body.balance, events: body.events ?? [] });
    } catch (topUpError) {
      setError(topUpError instanceof Error ? topUpError.message : walletMessages.topUpError);
    } finally {
      setIsToppingUp(false);
    }
  }

  return (
    <section className="rounded-[1.75rem] border border-[color:var(--line)] bg-black/20 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-[11px] tracking-[0.18em] text-[color:var(--accent)]">
            <CreditCard className="size-4" />
            {walletMessages.eyebrow}
          </p>
          <h2 className="font-serif text-3xl text-[color:var(--foreground)]">{walletMessages.title}</h2>
          <p className="max-w-2xl text-sm leading-7 text-[color:var(--muted)]">{walletMessages.description}</p>
        </div>
        <div className="rounded-[1.5rem] border border-white/10 bg-white/5 px-5 py-4 text-center">
          <p className="text-[10px] tracking-[0.14em] text-[color:var(--muted)]">{walletMessages.balance}</p>
          <p className="mt-2 font-serif text-4xl text-[color:var(--foreground)]">
            {isLoading ? <Loader2 className="mx-auto size-7 animate-spin text-[color:var(--accent)]" /> : (wallet?.balance ?? 0).toLocaleString('ar-SA')}
          </p>
        </div>
      </div>

      {error ? <p className="mt-4 rounded-[1.25rem] border border-[rgba(245,168,161,0.22)] bg-[rgba(245,168,161,0.08)] px-4 py-3 text-sm text-[color:var(--danger)]">{error}</p> : null}

      <div className="mt-5 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
          <p className="text-[11px] tracking-[0.14em] text-[color:var(--muted)]">{walletMessages.fakeTopUp}</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <input
              className="min-w-28 rounded-full border border-white/10 bg-black/30 px-4 py-3 text-sm text-[color:var(--foreground)] outline-none ring-[color:var(--ring)] focus:ring-2"
              inputMode="numeric"
              min="1"
              max="100"
              onChange={(event) => setAmount(event.target.value)}
              type="number"
              value={amount}
            />
            <Button disabled={isToppingUp} onClick={topUp} type="button" variant="secondary">
              {isToppingUp ? walletMessages.adding : walletMessages.addCredits}
              <PlusCircle className="size-4" />
            </Button>
          </div>
          <p className="mt-3 text-xs leading-6 text-[color:var(--muted)]">{walletMessages.adminHelp}</p>
        </div>

        <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
          <p className="text-[11px] tracking-[0.14em] text-[color:var(--muted)]">{walletMessages.recentActivity}</p>
          <ul className="mt-3 space-y-2">
            {(wallet?.events ?? []).slice(0, 5).map((event) => (
              <li className="flex items-center justify-between gap-3 rounded-[1.1rem] bg-black/20 px-3 py-2 text-sm" key={event.id}>
                <span className="text-[color:var(--foreground)]">{formatEventLabel(event.eventType)}</span>
                <span className={event.creditDelta > 0 ? 'text-emerald-200' : 'text-rose-200'}>
                  {event.creditDelta > 0 ? '+' : ''}{event.creditDelta.toLocaleString('ar-SA')}
                </span>
                <span className="job-time text-xs text-[color:var(--muted)]">{formatDateTime(event.createdAt)}</span>
              </li>
            ))}
            {!isLoading && !(wallet?.events ?? []).length ? <li className="text-sm text-[color:var(--muted)]">{walletMessages.noActivity}</li> : null}
          </ul>
        </div>
      </div>
    </section>
  );
}
