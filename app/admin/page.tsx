import { listGenerationJobs } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const jobs = await listGenerationJobs();

  return (
    <section className="page stack-xl">
      <div className="stack">
        <p className="eyebrow">Admin</p>
        <h1>Recent jobs</h1>
      </div>

      <div className="card table-scroll">
        <table className="jobs-table">
          <thead>
            <tr>
              <th>Job</th>
              <th>Status</th>
              <th>User</th>
              <th>Format</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {jobs.length ? (
              jobs.map((job) => (
                <tr key={job.id}>
                  <td>
                    <a className="job-id" href={`/jobs/${job.id}`}>{job.id.slice(0, 8)}</a>
                  </td>
                  <td>{job.status}</td>
                  <td className="job-meta">{job.userId}</td>
                  <td>{job.outputFormat}</td>
                  <td className="job-time">{new Date(job.createdAt).toLocaleString()}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5}>No jobs yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
