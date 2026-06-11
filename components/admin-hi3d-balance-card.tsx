'use client';

import { useState } from 'react';
import { Landmark, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDateTime, formatNumber } from '@/lib/locale';
import { messages } from '@/lib/messages';

export function AdminHi3DBalanceCard() {
  const adminHi3dBalanceMessages = messages.adminHi3dBalance;
  const [balance, setBalance] = useState<number | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadBalance() {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/hi3d/balance');
      const body = (await response.json()) as { totalBalance?: number; error?: string };
      if (!response.ok || typeof body.totalBalance !== 'number') {
        throw new Error(body.error || adminHi3dBalanceMessages.loadError);
      }

      setBalance(body.totalBalance);
      setUpdatedAt(new Date().toISOString());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : adminHi3dBalanceMessages.loadError);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="rounded-[1.8rem] border border-[color:var(--line)] bg-white/5 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.22)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] tracking-[0.14em] text-[color:var(--muted)]">{adminHi3dBalanceMessages.eyebrow}</p>
          <h2 className="mt-3 font-serif text-3xl text-[color:var(--foreground)]">{balance === null ? adminHi3dBalanceMessages.empty : formatNumber(balance, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>
          <p className="mt-2 text-sm text-[color:var(--muted)]">{adminHi3dBalanceMessages.description}</p>
          {updatedAt ? <p className="mt-2 text-xs text-[color:var(--muted-strong)]">{adminHi3dBalanceMessages.updatedAt} {formatDateTime(updatedAt)}</p> : null}
          {error ? <p className="mt-2 text-sm text-[color:var(--danger)]">{error}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-2 self-start">
          <span className="flex size-12 items-center justify-center rounded-full border border-white/10 bg-black/20 text-[color:var(--accent)]">
            <Landmark className="size-5" />
          </span>
          <Button aria-label={adminHi3dBalanceMessages.refresh} disabled={isLoading} onClick={loadBalance} size="icon" title={adminHi3dBalanceMessages.refresh} type="button" variant="secondary">
            {isLoading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          </Button>
        </div>
      </div>
    </section>
  );
}
