'use client';

import { useEffect, useState } from 'react';

type JobPayload = {
  job: {
    id: string;
    status: string;
    errorMessage?: string;
    createdAt: string;
    completedAt?: string;
  };
  resultUrl: string | null;
  coverUrl: string | null;
  events: Array<{ id: string; eventType: string; createdAt: string }>;
};

export function JobStatus({ jobId }: { jobId: string }) {
  const [data, setData] = useState<JobPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const response = await fetch(`/api/generations/${jobId}`, {
        headers: {
          'x-demo-user': 'demo-user',
        },
      });
      const body = (await response.json()) as JobPayload & { error?: string };
      if (!response.ok) {
        throw new Error(body.error || 'Failed to load job.');
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
        setError(loadError instanceof Error ? loadError.message : 'Failed to load job.');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [jobId]);

  async function retryJob() {
    const response = await fetch(`/api/generations/${jobId}/retry`, {
      method: 'POST',
      headers: { 'x-demo-user': 'demo-user' },
    });
    const body = (await response.json()) as { jobId?: string; error?: string };
    if (!response.ok || !body.jobId) {
      setError(body.error || 'Retry failed.');
      return;
    }
    window.location.href = `/jobs/${body.jobId}`;
  }

  if (error) {
    return <p className="error">{error}</p>;
  }
  if (!data) {
    return <p>Loading job…</p>;
  }

  return (
    <div className="stack-lg">
      <div className="card stack">
        <p className="eyebrow">Current status</p>
        <h2>{data.job.status}</h2>
        <p>Created {new Date(data.job.createdAt).toLocaleString()}</p>
        {data.job.errorMessage ? <p className="error">{data.job.errorMessage}</p> : null}
        {data.resultUrl ? (
          <div className="actions-row">
            <a className="primary-button" href={data.resultUrl}>
              Download .glb
            </a>
          </div>
        ) : null}
        {!data.resultUrl && ['failed', 'result_download_failed'].includes(data.job.status) ? (
          <button className="secondary-button" onClick={retryJob} type="button">
            Retry job
          </button>
        ) : null}
      </div>

      <div className="card stack">
        <p className="eyebrow">Timeline</p>
        <ul className="timeline">
          {data.events.map((event) => (
            <li key={event.id}>
              <strong>{event.eventType}</strong>
              <span>{new Date(event.createdAt).toLocaleTimeString()}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
