import { JobStatus } from '@/components/job-status';

export default async function JobPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;

  return (
    <section className="page stack-xl">
      <div className="stack">
        <p className="eyebrow">Job progress</p>
        <h1>Generation job</h1>
        <p>Track submission, Hi3D processing, and result download state.</p>
      </div>
      <JobStatus jobId={jobId} />
    </section>
  );
}
