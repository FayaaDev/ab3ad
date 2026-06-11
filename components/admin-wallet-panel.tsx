'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Gift, Loader2, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { AnimatedList } from '@/components/ui/animated-list';
import { formatDateTime, formatEventLabel, formatNumber } from '@/lib/locale';
import { messages } from '@/lib/messages';
import { cn } from '@/lib/utils';
import type { WalletSummary } from '@/lib/types';

export function AdminWalletPanel({ initialSummaries }: { initialSummaries: WalletSummary[] }) {
  const adminWalletMessages = messages.adminWallet;
  const [summaries, setSummaries] = useState(initialSummaries);
  const [expandedUsers, setExpandedUsers] = useState<Record<string, boolean>>({});
  const [target, setTarget] = useState(initialSummaries[0]?.email ?? '');
  const [search, setSearch] = useState('');
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [amount, setAmount] = useState('10');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pickerRef = useRef<HTMLDivElement | null>(null);

  const sortedSummaries = useMemo(() => [...summaries].sort((a, b) => b.balance - a.balance), [summaries]);
  const selectedSummary = useMemo(() => summaries.find((summary) => summary.email === target) ?? null, [summaries, target]);
  const filteredSummaries = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) {
      return sortedSummaries;
    }

    return sortedSummaries.filter((summary) => [summary.name, summary.email, summary.userId].some((value) => value.toLowerCase().includes(normalizedSearch)));
  }, [search, sortedSummaries]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!pickerRef.current?.contains(event.target as Node)) {
        setIsPickerOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  function selectUser(summary: WalletSummary) {
    setTarget(summary.email);
    setSearch('');
    setIsPickerOpen(false);
    setError(null);
    setNotice(null);
  }

  async function adjustCredits() {
    setIsSubmitting(true);
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
        throw new Error(body.error || adminWalletMessages.adjustError);
      }
      const adjustedUser = body.user;

      setSummaries((current) => {
        const next = current.filter((summary) => summary.userId !== adjustedUser.id);
        next.unshift({
          userId: adjustedUser.id,
          email: adjustedUser.email,
          name: adjustedUser.name,
          balance: body.balance ?? 0,
          recentEvents: body.events ?? [],
        });
        return next;
      });
      setNotice(adminWalletMessages.adjustSuccess);
    } catch (adjustError) {
      setError(adjustError instanceof Error ? adjustError.message : adminWalletMessages.adjustError);
    } finally {
      setIsSubmitting(false);
    }
  }

  function toggleExpanded(userId: string) {
    setExpandedUsers((current) => ({
      ...current,
      [userId]: !current[userId],
    }));
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
          <p className="text-[11px] tracking-[0.14em] text-[color:var(--muted)]">{adminWalletMessages.manualAdjustment}</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <div className="min-w-56 flex-1" ref={pickerRef}>
              <button
                className="flex w-full items-center justify-between rounded-full border border-white/10 bg-black/30 px-4 py-3 text-start text-sm text-[color:var(--foreground)] outline-none ring-[color:var(--ring)] transition focus:ring-2"
                onClick={() => setIsPickerOpen((current) => !current)}
                type="button"
              >
                <span className="truncate">
                  {selectedSummary ? `${selectedSummary.name} · ${selectedSummary.email}` : adminWalletMessages.emailPlaceholder}
                </span>
                <Search className="ms-3 size-4 shrink-0 text-[color:var(--muted)]" />
              </button>

              {isPickerOpen ? (
                <div className="relative z-10 mt-3 overflow-hidden rounded-[1.4rem] border border-white/10 bg-[rgba(8,10,18,0.96)] p-3 shadow-[0_30px_100px_rgba(0,0,0,0.4)] backdrop-blur">
                  <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-2">
                    <Search className="size-4 text-[color:var(--muted)]" />
                    <input
                      autoFocus
                      className="min-w-0 flex-1 bg-transparent text-sm text-[color:var(--foreground)] outline-none placeholder:text-[color:var(--muted)]"
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder={adminWalletMessages.emailPlaceholder}
                      type="text"
                      value={search}
                    />
                  </div>

                  <div className="mt-3 max-h-64 overflow-y-auto">
                    {filteredSummaries.length ? (
                      <AnimatedList>
                        {filteredSummaries.map((summary) => (
                          <button
                            className={cn(
                              'flex w-full items-start justify-between gap-3 rounded-[1.1rem] border border-white/8 bg-white/[0.03] px-3 py-3 text-start transition hover:bg-white/[0.06]',
                              summary.email === target ? 'border-[color:var(--accent)]/30 bg-[color:var(--accent)]/10' : '',
                            )}
                            key={summary.userId}
                            onClick={() => selectUser(summary)}
                            type="button"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm text-[color:var(--foreground)]">{summary.name}</p>
                              <p className="truncate text-xs text-[color:var(--muted)]">{summary.email}</p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <span className="text-xs text-[color:var(--muted-strong)]">{formatNumber(summary.balance)}</span>
                              {summary.email === target ? <Check className="size-4 text-[color:var(--accent)]" /> : null}
                            </div>
                          </button>
                        ))}
                      </AnimatedList>
                    ) : (
                      <p className="px-2 py-3 text-sm text-[color:var(--muted)]">{adminWalletMessages.empty}</p>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
            <input
              className="w-28 rounded-full border border-white/10 bg-black/30 px-4 py-3 text-sm text-[color:var(--foreground)] outline-none ring-[color:var(--ring)] focus:ring-2"
              min="-1000"
              max="1000"
              step="1"
              onChange={(event) => setAmount(event.target.value)}
              placeholder={adminWalletMessages.amountPlaceholder}
              type="number"
              value={amount}
            />
            <Button disabled={isSubmitting} onClick={adjustCredits} type="button" variant="secondary">
              {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Gift className="size-4" />}
              {adminWalletMessages.adjust}
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
                  <td className="px-6 py-5 align-top">
                    <p>{summary.name}</p>
                    <p className="job-meta text-xs text-[color:var(--muted)]">{summary.email}</p>
                    <p className="job-meta text-xs text-[color:var(--muted)]">{summary.userId}</p>
                  </td>
                  <td className="px-6 py-5 align-top font-serif text-3xl">{formatNumber(summary.balance)}</td>
                  <td className="px-6 py-5 align-top">
                    {summary.recentEvents.length ? (
                      <>
                        <ul className="space-y-2">
                          {(expandedUsers[summary.userId] ? summary.recentEvents : summary.recentEvents.slice(0, 2)).map((event) => (
                            <li className="flex flex-wrap items-center gap-2 text-xs text-[color:var(--muted-strong)]" key={event.id}>
                              <span>{formatEventLabel(event.eventType)}</span>
                              <span className={event.creditDelta > 0 ? 'text-emerald-200' : 'text-rose-200'}>
                                {event.creditDelta > 0 ? '+' : ''}{formatNumber(event.creditDelta)}
                              </span>
                              <span className="job-time">{formatDateTime(event.createdAt)}</span>
                            </li>
                          ))}
                        </ul>
                        {summary.recentEvents.length > 2 ? (
                          <button
                            className="mt-3 text-xs text-[color:var(--accent)] transition-opacity hover:opacity-80"
                            onClick={() => toggleExpanded(summary.userId)}
                            type="button"
                          >
                            {expandedUsers[summary.userId] ? adminWalletMessages.showLess : adminWalletMessages.showMore}
                          </button>
                        ) : null}
                      </>
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
