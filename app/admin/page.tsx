import { redirect } from 'next/navigation';
import { AdminWalletPanel } from '@/components/admin-wallet-panel';
import { AdminAuthError, AuthError, requireAdminUser } from '@/lib/auth';
import { formatDateTime, formatStatusLabel } from '@/lib/locale';
import { messages } from '@/lib/messages';
import { listGenerationJobs, listWalletSummaries } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  try {
    await requireAdminUser();
  } catch (error) {
    if (error instanceof AuthError) {
      redirect('/login' as never);
    }
    if (error instanceof AdminAuthError) {
      return <p className="rounded-[1.5rem] border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{messages.adminPage.adminOnly}</p>;
    }
    throw error;
  }

  const [jobs, walletSummaries] = await Promise.all([listGenerationJobs(), listWalletSummaries()]);
  const completedJobs = jobs.filter((job) => job.status === 'completed').length;
  const activeJobs = jobs.filter((job) => !['completed', 'failed', 'result_download_failed', 'cancelled', 'expired'].includes(job.status)).length;
  const failedJobs = jobs.filter((job) => ['failed', 'result_download_failed'].includes(job.status)).length;

  return (
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
        <div className="rounded-[2.5rem] border border-[color:var(--line)] bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-8 shadow-[0_30px_100px_rgba(0,0,0,0.26)]">
          <p className="text-[11px] tracking-[0.18em] text-[color:var(--accent)]">{messages.adminPage.eyebrow}</p>
          <h1 className="mt-4 font-serif text-5xl text-[color:var(--foreground)] sm:text-6xl">{messages.adminPage.title}</h1>
          <p className="mt-4 max-w-2xl text-sm leading-8 text-[color:var(--muted-strong)] sm:text-base">
            {messages.adminPage.description}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
          {[
            { label: messages.adminPage.totalJobs, value: jobs.length },
            { label: messages.adminPage.activeJobs, value: activeJobs },
            { label: messages.adminPage.completedJobs, value: completedJobs },
            { label: messages.adminPage.needsAttention, value: failedJobs },
          ].map((stat) => (
            <div key={stat.label} className="rounded-[1.8rem] border border-[color:var(--line)] bg-white/5 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.22)]">
              <p className="text-[10px] tracking-[0.14em] text-[color:var(--muted)]">{stat.label}</p>
              <p className="mt-3 font-serif text-4xl text-[color:var(--foreground)]">{stat.value.toLocaleString('ar-SA')}</p>
            </div>
          ))}
        </div>
      </section>

      <AdminWalletPanel initialSummaries={walletSummaries} />

      <section className="overflow-hidden rounded-[2.4rem] border border-[color:var(--line)] bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] shadow-[0_30px_100px_rgba(0,0,0,0.26)]">
        <div className="border-b border-white/10 px-6 py-5">
          <p className="text-[11px] tracking-[0.18em] text-[color:var(--accent)]">{messages.adminPage.tableTitle}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="text-start text-[11px] tracking-[0.14em] text-[color:var(--muted)]">
                <th className="px-6 py-4 font-medium">{messages.adminPage.columns.job}</th>
                <th className="px-6 py-4 font-medium">{messages.adminPage.columns.status}</th>
                <th className="px-6 py-4 font-medium">{messages.adminPage.columns.user}</th>
                <th className="px-6 py-4 font-medium">{messages.adminPage.columns.format}</th>
                <th className="px-6 py-4 font-medium">{messages.adminPage.columns.diagnostics}</th>
                <th className="px-6 py-4 font-medium">{messages.adminPage.columns.updatedAt}</th>
              </tr>
            </thead>
            <tbody>
              {jobs.length ? (
                jobs.map((job) => (
                  <tr key={job.id} className="border-t border-white/10 text-[color:var(--foreground)] transition-colors hover:bg-white/4">
                    <td className="px-6 py-5">
                      <a className="job-time inline-flex rounded-full border border-white/10 bg-black/20 px-4 py-2 text-xs tracking-[0.14em] text-[color:var(--accent)]" href={`/jobs/${job.id}`}>
                        {job.id.slice(0, 8)}
                      </a>
                    </td>
                    <td className="px-6 py-5">
                      <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs tracking-[0.14em] text-[color:var(--muted-strong)]">{formatStatusLabel(job.status)}</span>
                    </td>
                    <td className="job-meta px-6 py-5 text-[color:var(--muted-strong)]">{job.userId}</td>
                    <td className="px-6 py-5 text-[color:var(--muted-strong)]">{job.outputFormat}</td>
                    <td className="px-6 py-5 text-xs leading-6 text-[color:var(--muted-strong)]">
                      {job.errorCode || job.errorMessage ? (
                        <span>
                          {job.errorCode ?? 'error'}
                          {job.errorMessage ? ` · ${job.errorMessage}` : ''}
                        </span>
                      ) : job.hi3dTaskId ? (
                        <span className="text-[color:var(--accent)]">{job.hi3dTaskId}</span>
                      ) : (
                        messages.adminPage.none
                      )}
                    </td>
                    <td className="job-time px-6 py-5 text-[color:var(--muted-strong)]">{formatDateTime(job.updatedAt)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-6 py-8 text-[color:var(--muted)]" colSpan={6}>
                    {messages.adminPage.empty}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
