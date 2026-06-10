'use client';

import Script from 'next/script';
import { createElement, useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, Download, Layers3, RefreshCcw, Sparkles } from 'lucide-react';

import { Button, buttonVariants } from '@/components/ui/button';
import { formatDateTime, formatEventLabel, formatStatusLabel, formatTime } from '@/lib/locale';
import { interpolate, messages } from '@/lib/messages';
import { cn } from '@/lib/utils';

type JobPayload = {
  job: {
    id: string;
    status: string;
    errorMessage?: string;
    createdAt: string;
    completedAt?: string;
  };
  resultUrl: string | null;
  previewUrl: string | null;
  coverUrl: string | null;
  events: Array<{ id: string; eventType: string; createdAt: string }>;
};

export function JobStatus({ jobId }: { jobId: string }) {
  const [data, setData] = useState<JobPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const response = await fetch(`/api/generations/${jobId}`);
      const body = (await response.json()) as JobPayload & { error?: string };
      if (response.status === 401) {
        window.location.href = `/login?next=/jobs/${jobId}`;
        return;
      }
      if (!response.ok) {
        throw new Error(body.error || messages.jobStatus.loadError);
      }
      if (!cancelled) {
        setData(body);
      }
      if (!['completed', 'failed', 'result_download_failed', 'cancelled', 'expired'].includes(body.job.status)) {
        setTimeout(load, 1500);
      }
    }

    load().catch((loadError) => {
      if (!cancelled) {
        setError(loadError instanceof Error ? loadError.message : messages.jobStatus.loadError);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [jobId]);

  async function retryJob() {
    const response = await fetch(`/api/generations/${jobId}/retry`, {
      method: 'POST',
    });
    const body = (await response.json()) as { jobId?: string; error?: string };
    if (response.status === 401) {
      window.location.href = `/login?next=/jobs/${jobId}`;
      return;
    }
    if (!response.ok || !body.jobId) {
      setError(body.error || messages.jobStatus.retryFailed);
      return;
    }
    window.location.href = `/jobs/${body.jobId}`;
  }

  const terminalStates = ['completed', 'failed', 'result_download_failed', 'cancelled', 'expired'];

  function statusTone(status: string) {
    if (status === 'completed') {
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200';
    }

    if (status === 'failed' || status === 'result_download_failed' || status === 'cancelled' || status === 'expired') {
      return 'border-rose-400/30 bg-rose-400/10 text-rose-200';
    }

    return 'border-[rgba(193,168,106,0.28)] bg-[rgba(193,168,106,0.1)] text-[color:var(--accent-strong)]';
  }

  if (error) {
    return <p className="rounded-[1.5rem] border border-[rgba(245,168,161,0.22)] bg-[rgba(245,168,161,0.08)] px-4 py-3 text-sm text-[color:var(--danger)]">{error}</p>;
  }
  if (!data) {
    return <p className="text-sm tracking-[0.14em] text-[color:var(--muted)]">{messages.jobStatus.loading}</p>;
  }

  return (
    <>
      <Script
        type="module"
        src="https://ajax.googleapis.com/ajax/libs/model-viewer/4.1.0/model-viewer.min.js"
        crossOrigin="anonymous"
        strategy="afterInteractive"
      />
      <div className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
        <div className="space-y-6">
          <section className="overflow-hidden rounded-[2.4rem] border border-[color:var(--line)] bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] shadow-[0_26px_90px_rgba(0,0,0,0.26)]">
            <div className="grid gap-6 p-6 lg:grid-cols-[1fr_19rem] lg:p-8">
              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-3">
                  <span className={cn('rounded-full border px-4 py-2 text-xs tracking-[0.14em]', statusTone(data.job.status))}>{formatStatusLabel(data.job.status)}</span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs tracking-[0.14em] text-[color:var(--muted)]">{messages.jobStatus.jobLabel} {jobId.slice(0, 8)}</span>
                </div>

                <div className="space-y-3">
                  <p className="text-[11px] tracking-[0.18em] text-[color:var(--accent)]">{messages.jobStatus.currentStatus}</p>
                  <h2 className="font-serif text-4xl text-[color:var(--foreground)] sm:text-5xl">{messages.jobStatus.title}</h2>
                  <p className="max-w-2xl text-sm leading-7 text-[color:var(--muted)]">{messages.jobStatus.description}</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
                    <p className="text-[11px] tracking-[0.14em] text-[color:var(--muted)]">{messages.jobStatus.createdAt}</p>
                    <p className="job-time mt-3 text-sm leading-6 text-[color:var(--foreground)]">{formatDateTime(data.job.createdAt)}</p>
                  </div>
                  <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
                    <p className="text-[11px] tracking-[0.14em] text-[color:var(--muted)]">{messages.jobStatus.completedAt}</p>
                    <p className="job-time mt-3 text-sm leading-6 text-[color:var(--foreground)]">{data.job.completedAt ? formatDateTime(data.job.completedAt) : messages.jobStatus.inProgress}</p>
                  </div>
                  <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
                    <p className="text-[11px] tracking-[0.14em] text-[color:var(--muted)]">{messages.jobStatus.timelineEvents}</p>
                    <p className="mt-3 text-sm leading-6 text-[color:var(--foreground)]">{interpolate(messages.jobStatus.recordedPoints, { count: data.events.length.toLocaleString('ar-SA') })}</p>
                  </div>
                </div>

                {data.job.errorMessage ? (
                  <div className="flex gap-3 rounded-[1.5rem] border border-[rgba(245,168,161,0.22)] bg-[rgba(245,168,161,0.08)] p-4 text-[color:var(--danger)]">
                    <AlertTriangle className="mt-0.5 size-5 shrink-0" />
                    <p className="text-sm leading-6">{data.job.errorMessage}</p>
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center gap-3">
                  {data.resultUrl ? (
                    <a className={buttonVariants({ size: 'lg' })} href={data.resultUrl}>
                      {messages.jobStatus.download}
                      <Download className="size-4" />
                    </a>
                  ) : null}
                  {!data.resultUrl && ['failed', 'result_download_failed'].includes(data.job.status) ? (
                    <Button onClick={retryJob} size="lg" type="button" variant="secondary">
                      {messages.jobStatus.retry}
                      <RefreshCcw className="size-4" />
                    </Button>
                  ) : null}
                  <a className={buttonVariants({ size: 'lg', variant: 'ghost' })} href="/">
                    {messages.jobStatus.newModel}
                    <ArrowRight className="size-4" />
                  </a>
                </div>
              </div>

              <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-4">
                {data.previewUrl ? (
                  <div className="h-full min-h-[20rem] overflow-hidden rounded-[1.5rem] bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,0.14),transparent_26%),linear-gradient(180deg,#3f3322,#15110d_48%,#0e0d12)]">
                    {createElement('model-viewer', {
                      src: data.previewUrl,
                      alt: messages.jobStatus.coverAlt,
                      className: 'block h-full min-h-[20rem] w-full bg-transparent [--poster-color:transparent]',
                      loading: 'eager',
                      reveal: 'auto',
                      interactionPrompt: 'none',
                      shadowIntensity: '1',
                      exposure: '1',
                      cameraOrbit: '0deg 75deg auto',
                      minCameraOrbit: 'auto 55deg auto',
                      maxCameraOrbit: 'auto 95deg auto',
                      disableZoom: true,
                      ar: false,
                      autoplay: true,
                      'auto-rotate': true,
                      'rotation-per-second': '18deg',
                    })}
                  </div>
                ) : data.coverUrl ? (
                  <img alt={messages.jobStatus.coverAlt} className="h-full w-full rounded-[1.5rem] object-cover" src={data.coverUrl} />
                ) : (
                  <div className="relative flex h-full min-h-[20rem] items-end overflow-hidden rounded-[1.5rem] bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,0.34),transparent_24%),linear-gradient(180deg,#3f3322,#15110d_48%,#0e0d12)] p-5">
                    <div className="absolute inset-x-[23%] bottom-[17%] top-[14%] rounded-[48%_52%_58%_42%/46%_40%_60%_54%] border border-white/20 bg-[linear-gradient(180deg,rgba(255,255,255,0.42),rgba(255,255,255,0.06))] shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_30px_50px_rgba(0,0,0,0.18)]" />
                    <div className="absolute inset-x-[30%] bottom-[10%] h-[14%] rounded-full bg-black/40 blur-2xl" />
                    <div className="relative z-10 space-y-2">
                      <p className="text-[11px] tracking-[0.14em] text-[color:var(--accent)]">{messages.jobStatus.previewPending}</p>
                      <p className="text-sm leading-6 text-[color:var(--muted-strong)]">{messages.jobStatus.previewPendingDescription}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-3">
            {[
              { icon: Layers3, title: messages.jobStatus.processingTrack, text: terminalStates.includes(data.job.status) ? messages.jobStatus.processingTrackDone : messages.jobStatus.processingTrackActive },
              { icon: Sparkles, title: messages.jobStatus.resultStorage, text: data.resultUrl ? messages.jobStatus.resultStorageReady : messages.jobStatus.resultStoragePending },
              { icon: RefreshCcw, title: messages.jobStatus.recovery, text: ['failed', 'result_download_failed'].includes(data.job.status) ? messages.jobStatus.recoveryReady : messages.jobStatus.recoveryIdle },
            ].map((item) => (
              <div key={item.title} className="rounded-[1.7rem] border border-[color:var(--line)] bg-white/5 p-5">
                <item.icon className="mb-4 size-5 text-[color:var(--accent)]" />
                <p className="text-[11px] tracking-[0.14em] text-[color:var(--muted)]">{item.title}</p>
                <p className="mt-2 text-sm leading-6 text-[color:var(--foreground)]">{item.text}</p>
              </div>
            ))}
          </section>
        </div>

        <section className="rounded-[2.2rem] border border-[color:var(--line)] bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-6 shadow-[0_26px_90px_rgba(0,0,0,0.26)]">
          <p className="text-[11px] tracking-[0.18em] text-[color:var(--accent)]">{messages.jobStatus.timeline}</p>
          <h3 className="mt-3 font-serif text-3xl text-[color:var(--foreground)]">{messages.jobStatus.eventLog}</h3>
          <ul className="mt-6 space-y-4">
            {data.events.map((event, index) => (
              <li key={event.id} className="relative rounded-[1.6rem] border border-white/10 bg-black/20 p-4 ps-6">
                <div className="absolute bottom-4 start-4 top-4 w-px bg-white/10" />
                <div className="absolute start-[calc(1rem-0.34rem)] top-6 size-3 rounded-full bg-[color:var(--accent)] shadow-[0_0_0_6px_rgba(193,168,106,0.1)]" />
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <p className="text-[11px] tracking-[0.14em] text-[color:var(--muted)]">{messages.jobStatus.station} {(index + 1).toLocaleString('ar-SA', { minimumIntegerDigits: 2 })}</p>
                    <strong className="block text-base font-medium text-[color:var(--foreground)]">{formatEventLabel(event.eventType)}</strong>
                  </div>
                  <span className="job-time text-xs tracking-[0.12em] text-[color:var(--muted)]">{formatTime(event.createdAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
