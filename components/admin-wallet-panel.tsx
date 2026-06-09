'use client';

import { useMemo, useState } from 'react';
import { Gift, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { formatDateTime, formatEventLabel } from '@/lib/locale';
import { messages } from '@/lib/messages';
import type { WalletSummary } from '@/lib/types';

export function AdminWalletPanel({ initialSummaries }: { initialSummaries: WalletSummary[] }) {
  const adminWalletMessages = messages.adminWallet;
  const [summaries, setSummaries] = useState(initialSummaries);
  const [target, setTarget] = useState(initialSummaries[0]?.email ?? '');
  const [amount, setAmount] = useState('10');
  const [isGranting, setIsGranting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sortedSummaries = useMemo(() => [...summaries].sort((a, b) => b.balance - a.balance), [summaries]);

  async function grantCredits() {
    setIsGranting(true);
    setNotice(null);
    setError(null);
    try {
      const response = await fetch('/api/admin/wallet/grants', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: target, amount: Number(amount) }),
      });
      const body = (await response.json()) as {
        user?: { id: string; email: string; name: string };
        balance?: number;
        events?: WalletSummary['recentEvents'];
        error?: string;
      };
      if (!response.ok || !body.user) {
        throw new Error(body.error || adminWalletMessages.grantError);
      }
      const grantedUser = body.user;

      setSummaries((current) => {
        const next = current.filter((summary) => summary.userId !== grantedUser.id);
        next.unshift({
          userId: grantedUser.id,
          email: grantedUser.email,
          name: grantedUser.name,
          balance: body.balance ?? 0,
          recentEvents: body.events ?? [],
        });
        return next;
      });
      setNotice(adminWalletMessages.grantSuccess);
    } catch (grantError) {
      setError(grantError instanceof Error ? grantError.message : adminWalletMessages.grantError);
    } finally {
      setIsGranting(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-[2.4rem] border border-[color:var(--line)] bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] shadow-[0_30px_100px_rgba(0,0,0,0.26)]">
      <div className="grid gap-5 border-b border-white/10 px-6 py-5 lg:grid-cols-[1fr_0.9fr]">
        <div>
          <p className="text-[11px] tracking-[0.18em] text-[color:var(--accent)]">{adminWalletMessages.eyebrow}</p>
          <h2 className="mt-3 font-serif text-3xl text-[color:var(--foreground)]">{adminWalletMessages.title}</h2>
          <p className="mt-2 text-sm leading-7 text-[color:var(--muted)]">{adminWalletMessages.description}</p>
        </div>
        <div className="rounded-[1.6rem] border border-white/10 bg-black/20 p-4">
          <p className="text-[11px] tracking-[0.14em] text-[color:var(--muted)]">{adminWalletMessages.manualGrant}</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <input
              className="min-w-56 flex-1 rounded-full border border-white/10 bg-black/30 px-4 py-3 text-sm text-[color:var(--foreground)] outline-none ring-[color:var(--ring)] focus:ring-2"
              onChange={(event) => setTarget(event.target.value)}
              placeholder={adminWalletMessages.emailPlaceholder}
              type="email"
              value={target}
            />
            <input
              className="w-28 rounded-full border border-white/10 bg-black/30 px-4 py-3 text-sm text-[color:var(--foreground)] outline-none ring-[color:var(--ring)] focus:ring-2"
              min="1"
              max="1000"
              onChange={(event) => setAmount(event.target.value)}
              type="number"
              value={amount}
            />
            <Button disabled={isGranting} onClick={grantCredits} type="button" variant="secondary">
              {isGranting ? <Loader2 className="size-4 animate-spin" /> : <Gift className="size-4" />}
              {adminWalletMessages.grant}
            </Button>
          </div>
          {notice ? <p className="mt-3 text-sm text-emerald-200">{notice}</p> : null}
          {error ? <p className="mt-3 text-sm text-[color:var(--danger)]">{error}</p> : null}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="text-start text-[11px] tracking-[0.14em] text-[color:var(--muted)]">
              <th className="px-6 py-4 font-medium">{adminWalletMessages.columns.user}</th>
              <th className="px-6 py-4 font-medium">{adminWalletMessages.columns.balance}</th>
              <th className="px-6 py-4 font-medium">{adminWalletMessages.columns.activity}</th>
            </tr>
          </thead>
          <tbody>
            {sortedSummaries.length ? (
              sortedSummaries.map((summary) => (
                <tr key={summary.userId} className="border-t border-white/10 text-[color:var(--foreground)] transition-colors hover:bg-white/4">
                  <td className="px-6 py-5">
                    <p>{summary.name}</p>
                    <p className="job-meta text-xs text-[color:var(--muted)]">{summary.email}</p>
                    <p className="job-meta text-xs text-[color:var(--muted)]">{summary.userId}</p>
                  </td>
                  <td className="px-6 py-5 font-serif text-3xl">{summary.balance.toLocaleString('ar-SA')}</td>
                  <td className="px-6 py-5">
                    {summary.recentEvents.length ? (
                      <ul className="space-y-2">
                        {summary.recentEvents.map((event) => (
                          <li className="flex flex-wrap items-center gap-2 text-xs text-[color:var(--muted-strong)]" key={event.id}>
                            <span>{formatEventLabel(event.eventType)}</span>
                            <span className={event.creditDelta > 0 ? 'text-emerald-200' : 'text-rose-200'}>
                              {event.creditDelta > 0 ? '+' : ''}{event.creditDelta.toLocaleString('ar-SA')}
                            </span>
                            <span className="job-time">{formatDateTime(event.createdAt)}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-[color:var(--muted)]">{adminWalletMessages.noActivity}</span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-6 py-8 text-[color:var(--muted)]" colSpan={3}>{adminWalletMessages.empty}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
