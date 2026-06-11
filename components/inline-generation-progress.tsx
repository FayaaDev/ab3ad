'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Download, LoaderCircle } from 'lucide-react';

import { AnimatedCircularProgressBar } from '@/components/ui/animated-circular-progress-bar';
import { buttonVariants } from '@/components/ui/button';
import { formatStatusLabel } from '@/lib/locale';
import { messages } from '@/lib/messages';
import { cn } from '@/lib/utils';

type JobPayload = {
  job: {
    id: string;
    status: string;
    errorMessage?: string;
  };
  resultUrl: string | null;
};

const terminalStatuses = ['completed', 'failed', 'result_download_failed', 'cancelled', 'expired'];

const progressSteps = messages.inlineGenerationProgress.steps;

function getProgressState(status: string) {
  if (status === 'failed' || status === 'result_download_failed' || status === 'cancelled' || status === 'expired') {
    return {
      activeIndex: -1,
      percent: 100,
      label: formatStatusLabel(status),
      failed: true,
    };
  }

  const activeIndex = progressSteps.findIndex((step) => step.statuses.includes(status));
  const activeStep = progressSteps[Math.max(activeIndex, 0)] ?? progressSteps[0];

  return {
    activeIndex,
    percent: activeStep.percent,
    label: activeStep.label,
    failed: false,
  };
}

export function InlineGenerationProgress({
  jobId,
  onTerminalStateChange,
}: {
  jobId: string;
  onTerminalStateChange?: (state: { isTerminal: boolean; status: string | null }) => void;
}) {
  const [data, setData] = useState<JobPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    async function load() {
      const response = await fetch(`/api/generations/${jobId}`);
      const body = (await response.json()) as JobPayload & { error?: string };

      if (response.status === 401) {
        window.location.href = '/login?next=/';
        return;
      }
      if (!response.ok) {
        throw new Error(body.error || messages.inlineGenerationProgress.loadError);
      }

      if (cancelled) {
        return;
      }

      setData(body);
      setError(null);

      if (!terminalStatuses.includes(body.job.status)) {
        timeoutId = setTimeout(() => {
          load().catch((loadError) => {
            if (!cancelled) {
              setError(loadError instanceof Error ? loadError.message : messages.inlineGenerationProgress.loadError);
            }
          });
        }, 1500);
      }
    }

    load().catch((loadError) => {
      if (!cancelled) {
        setError(loadError instanceof Error ? loadError.message : messages.inlineGenerationProgress.loadError);
      }
    });

    return () => {
      cancelled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [jobId]);

  const progress = useMemo(() => getProgressState(data?.job.status ?? 'queued'), [data?.job.status]);

  useEffect(() => {
    onTerminalStateChange?.({
      isTerminal: Boolean(data && terminalStatuses.includes(data.job.status)),
      status: data?.job.status ?? null,
    });
  }, [data, error, onTerminalStateChange]);

  if (error) {
    return <p className="rounded-[1.25rem] border border-[rgba(245,168,161,0.22)] bg-[rgba(245,168,161,0.08)] px-4 py-3 text-sm text-[color:var(--danger)]">{error}</p>;
  }

  return (
    <section className="rounded-[1.75rem] border border-[color:var(--line)] bg-black/20 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.22)]">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-3">
          <p className="text-[11px] tracking-[0.18em] text-[color:var(--accent)]">{messages.inlineGenerationProgress.eyebrow}</p>
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-xl text-[color:var(--foreground)]">{data ? progress.label : messages.inlineGenerationProgress.loading}</h3>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs tracking-[0.14em] text-[color:var(--muted)]">
              {data ? formatStatusLabel(data.job.status) : messages.inlineGenerationProgress.waiting}
            </span>
          </div>
          <p className="text-sm leading-6 text-[color:var(--muted)]">
            {progress.failed ? messages.inlineGenerationProgress.failedDescription : messages.inlineGenerationProgress.activeDescription}
          </p>
          {data?.job.errorMessage ? (
            <div className="flex gap-3 rounded-[1.25rem] border border-[rgba(245,168,161,0.22)] bg-[rgba(245,168,161,0.08)] p-4 text-[color:var(--danger)]">
              <AlertTriangle className="mt-0.5 size-5 shrink-0" />
              <p className="text-sm leading-6">{data.job.errorMessage}</p>
            </div>
          ) : null}
          {data?.resultUrl ? (
            <a className={buttonVariants({ size: 'lg' })} href={data.resultUrl}>
              {messages.inlineGenerationProgress.download}
              <Download className="size-4" />
            </a>
          ) : null}
        </div>

        <div className="flex items-center justify-center lg:min-w-44">
          <AnimatedCircularProgressBar
            className="size-32"
            gaugePrimaryColor={progress.failed ? 'rgb(245 168 161)' : 'rgb(193 168 106)'}
            gaugeSecondaryColor="rgba(255,255,255,0.12)"
            value={progress.percent}
          />
        </div>
      </div>

      <div className="mt-6 space-y-3">
        <div className="h-2 overflow-hidden rounded-full bg-white/10">
          <div
            aria-hidden="true"
            className={cn('h-full rounded-full transition-all duration-700', progress.failed ? 'bg-[color:var(--danger)]' : 'bg-[linear-gradient(90deg,var(--accent),var(--accent-strong))]')}
            style={{ width: `${progress.percent}%` }}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          {progressSteps.map((step, index) => {
            const isDone = !progress.failed && (progress.activeIndex === -1 ? step.percent <= progress.percent : index <= progress.activeIndex);
            const isActive = !progress.failed && index === progress.activeIndex;

            return (
              <div
                key={step.label}
                className={cn(
                  'rounded-[1.2rem] border px-4 py-3 text-sm transition-colors',
                  isDone ? 'border-[rgba(193,168,106,0.26)] bg-[rgba(193,168,106,0.12)] text-[color:var(--foreground)]' : 'border-white/10 bg-white/5 text-[color:var(--muted)]',
                  isActive ? 'shadow-[0_0_0_1px_rgba(193,168,106,0.35)]' : null,
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <span>{step.label}</span>
                  {isActive && !data?.resultUrl ? <LoaderCircle className="size-4 animate-spin text-[color:var(--accent)]" /> : null}
                </div>
                <p className="mt-2 text-xs tracking-[0.12em] text-[color:var(--muted)]">{step.percent}%</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
