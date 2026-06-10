'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CreditCard, Loader2, User2 } from 'lucide-react';

import { formatDateTime, formatEventLabel } from '@/lib/locale';
import { messages } from '@/lib/messages';

type WalletEvent = {
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

export function ProfileMenu({ userName }: { userName: string }) {
  const profileMessages = messages.profilePanel;
  const [isOpen, setIsOpen] = useState(false);
  const [wallet, setWallet] = useState<WalletPayload | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const loadWallet = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/wallet');
      const body = (await response.json()) as WalletPayload & { error?: string };
      if (!response.ok) {
        throw new Error(body.error || profileMessages.loadError);
      }
      setWallet({ balance: body.balance, events: body.events ?? [] });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : profileMessages.loadError);
    } finally {
      setIsLoading(false);
    }
  }, [profileMessages.loadError]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    void loadWallet();
  }, [isOpen, loadWallet]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    function handleWalletRefresh() {
      if (isOpen) {
        void loadWallet();
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    window.addEventListener('wallet:refresh', handleWalletRefresh);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('wallet:refresh', handleWalletRefresh);
    };
  }, [isOpen, loadWallet]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs tracking-[0.14em] text-[color:var(--foreground)] transition-colors hover:bg-white/10"
        onClick={() => setIsOpen((value) => !value)}
        type="button"
      >
        <User2 className="size-4" />
        {messages.siteHeader.profile}
      </button>

      {isOpen ? (
        <section className="absolute right-0 top-full z-50 mt-3 w-[min(22rem,calc(100vw-3rem))] rounded-[1.75rem] border border-[color:var(--line)] bg-[rgba(7,8,14,0.96)] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.38)] backdrop-blur-xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] tracking-[0.18em] text-[color:var(--accent)]">{profileMessages.eyebrow}</p>
              <h2 className="mt-2 text-sm text-[color:var(--foreground)]">{userName}</h2>
            </div>
            <div className="rounded-[1.2rem] border border-white/10 bg-white/5 px-4 py-3 text-center">
              <p className="text-[10px] tracking-[0.14em] text-[color:var(--muted)]">{profileMessages.balance}</p>
              <p className="mt-2 font-serif text-3xl text-[color:var(--foreground)]">
                {isLoading ? <Loader2 className="mx-auto size-6 animate-spin text-[color:var(--accent)]" /> : (wallet?.balance ?? 0).toLocaleString('ar-SA')}
              </p>
            </div>
          </div>

          {error ? <p className="mt-4 rounded-[1.25rem] border border-[rgba(245,168,161,0.22)] bg-[rgba(245,168,161,0.08)] px-4 py-3 text-sm text-[color:var(--danger)]">{error}</p> : null}

          <div className="mt-4 rounded-[1.4rem] border border-white/10 bg-white/5 p-4">
            <p className="flex items-center gap-2 text-[11px] tracking-[0.14em] text-[color:var(--muted)]">
              <CreditCard className="size-4" />
              {profileMessages.recentActivity}
            </p>
            <ul className="mt-3 space-y-2">
              {(wallet?.events ?? []).slice(0, 5).map((event) => (
                <li className="rounded-[1.1rem] bg-black/20 px-3 py-3 text-sm" key={event.id}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[color:var(--foreground)]">{formatEventLabel(event.eventType)}</span>
                    <span className={event.creditDelta > 0 ? 'text-emerald-200' : 'text-rose-200'}>
                      {event.creditDelta > 0 ? '+' : ''}{event.creditDelta.toLocaleString('ar-SA')}
                    </span>
                  </div>
                  <p className="job-time mt-2 text-xs text-[color:var(--muted)]">{formatDateTime(event.createdAt)}</p>
                </li>
              ))}
              {!isLoading && !(wallet?.events ?? []).length ? <li className="text-sm text-[color:var(--muted)]">{profileMessages.noActivity}</li> : null}
            </ul>
          </div>
        </section>
      ) : null}
    </div>
  );
}
