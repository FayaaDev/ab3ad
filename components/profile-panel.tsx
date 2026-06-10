'use client';

import { useCallback, useEffect, useState } from 'react';
import { CreditCard, Download, Loader2 } from 'lucide-react';

import { buttonVariants } from '@/components/ui/button';
import { formatDateTime, formatEventLabel, formatStatusLabel } from '@/lib/locale';
import { messages } from '@/lib/messages';
import { cn } from '@/lib/utils';

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

type ProfileJob = {
  id: string;
  status: string;
  createdAt: string;
  jobName: string;
  sourceImageUrl: string | null;
  resultUrl: string | null;
};

type ProfileJobsPayload = {
  jobs: ProfileJob[];
};

function statusTone(status: string) {
  if (status === 'completed') {
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200';
  }

  if (status === 'failed' || status === 'result_download_failed' || status === 'cancelled' || status === 'expired') {
    return 'border-rose-400/30 bg-rose-400/10 text-rose-200';
  }

  return 'border-[rgba(193,168,106,0.28)] bg-[rgba(193,168,106,0.1)] text-[color:var(--accent-strong)]';
}

export function ProfilePanel({ userName }: { userName: string }) {
  const profileMessages = messages.profilePanel;
  const [wallet, setWallet] = useState<WalletPayload | null>(null);
  const [jobs, setJobs] = useState<ProfileJob[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [walletResponse, jobsResponse] = await Promise.all([fetch('/api/wallet'), fetch('/api/profile/jobs')]);
      const walletBody = (await walletResponse.json()) as WalletPayload & { error?: string };
      const jobsBody = (await jobsResponse.json()) as ProfileJobsPayload & { error?: string };

      if (!walletResponse.ok) {
        throw new Error(walletBody.error || profileMessages.loadError);
      }
      if (!jobsResponse.ok) {
        throw new Error(jobsBody.error || profileMessages.loadError);
      }

      setWallet({ balance: walletBody.balance, events: walletBody.events ?? [] });
      setJobs(jobsBody.jobs ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : profileMessages.loadError);
    } finally {
      setIsLoading(false);
    }
  }, [profileMessages.loadError]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    function handleWalletRefresh() {
      void loadProfile();
    }

    window.addEventListener('wallet:refresh', handleWalletRefresh);

    return () => {
      window.removeEventListener('wallet:refresh', handleWalletRefresh);
    };
  }, [loadProfile]);

  return (
    <section className="overflow-hidden rounded-[2.4rem] border border-[color:var(--line)] bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] shadow-[0_30px_100px_rgba(0,0,0,0.26)]">
      <div className="grid gap-6 border-b border-white/10 px-6 py-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
        <div>
          <p className="text-[11px] tracking-[0.18em] text-[color:var(--accent)]">{profileMessages.eyebrow}</p>
          <h2 className="mt-3 font-serif text-3xl text-[color:var(--foreground)] sm:text-4xl">{userName}</h2>
        </div>
        <div className="rounded-[1.6rem] border border-white/10 bg-black/20 px-5 py-4 text-center">
          <p className="text-[10px] tracking-[0.14em] text-[color:var(--muted)]">{profileMessages.balance}</p>
          <p className="mt-3 font-serif text-4xl text-[color:var(--foreground)]">
            {isLoading ? <Loader2 className="mx-auto size-7 animate-spin text-[color:var(--accent)]" /> : (wallet?.balance ?? 0).toLocaleString('ar-SA')}
          </p>
        </div>
      </div>

      <div className="px-6 py-6 lg:px-8">
        {error ? <p className="rounded-[1.25rem] border border-[rgba(245,168,161,0.22)] bg-[rgba(245,168,161,0.08)] px-4 py-3 text-sm text-[color:var(--danger)]">{error}</p> : null}

        <div className="rounded-[1.6rem] border border-white/10 bg-white/5 p-5">
          <p className="flex items-center gap-2 text-[11px] tracking-[0.14em] text-[color:var(--muted)]">
            <CreditCard className="size-4" />
            {profileMessages.recentActivity}
          </p>
          <ul className="mt-4 space-y-2">
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

        <div className="mt-6 rounded-[1.6rem] border border-white/10 bg-white/5 p-5">
          <p className="text-[11px] tracking-[0.14em] text-[color:var(--muted)]">{profileMessages.jobs}</p>
          <div className="mt-4 space-y-3">
            {jobs.map((job) => (
              <article className="rounded-[1.3rem] bg-black/20 p-4" key={job.id}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="size-20 overflow-hidden rounded-[1.1rem] border border-white/10 bg-white/5">
                      {job.sourceImageUrl ? <img alt={job.jobName} className="h-full w-full object-cover" src={job.sourceImageUrl} /> : null}
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-[color:var(--foreground)]">{job.jobName}</p>
                      <p className="job-time text-xs text-[color:var(--muted)]">{formatDateTime(job.createdAt)}</p>
                      <span className={cn('inline-flex rounded-full border px-3 py-1 text-xs tracking-[0.14em]', statusTone(job.status))}>
                        {formatStatusLabel(job.status)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <a className={buttonVariants({ size: 'sm', variant: 'ghost' })} href={`/jobs/${job.id}`}>
                      {profileMessages.viewJob}
                    </a>
                    {job.status === 'completed' && job.resultUrl ? (
                      <a className={buttonVariants({ size: 'sm' })} href={job.resultUrl}>
                        {profileMessages.download}
                        <Download className="size-4" />
                      </a>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
            {!isLoading && !jobs.length ? <p className="text-sm text-[color:var(--muted)]">{profileMessages.noJobs}</p> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
