import { formatDateTime, formatStatusLabel } from '@/lib/locale';
import { listGenerationJobs } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const jobs = await listGenerationJobs();
  const completedJobs = jobs.filter((job) => job.status === 'completed').length;
  const activeJobs = jobs.filter((job) => !['completed', 'failed', 'result_download_failed', 'cancelled', 'expired'].includes(job.status)).length;
  const failedJobs = jobs.filter((job) => ['failed', 'result_download_failed'].includes(job.status)).length;

  return (
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
        <div className="rounded-[2.5rem] border border-[color:var(--line)] bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-8 shadow-[0_30px_100px_rgba(0,0,0,0.26)]">
          <p className="text-[11px] tracking-[0.18em] text-[color:var(--accent)]">أرشيف الإدارة</p>
          <h1 className="mt-4 font-serif text-5xl text-[color:var(--foreground)] sm:text-6xl">أحدث المهام، بصيغة أقرب إلى الفهرس من الجدول الجاف.</h1>
          <p className="mt-4 max-w-2xl text-sm leading-8 text-[color:var(--muted-strong)] sm:text-base">
            راجع المهام النشطة، والنتائج المكتملة، والمحاولات الفاشلة من شاشة أرشيف واحدة مع الحفاظ على الوصول المباشر لكل سجل توليد.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
          {[
            { label: 'إجمالي المهام', value: jobs.length },
            { label: 'النشطة', value: activeJobs },
            { label: 'المكتملة', value: completedJobs },
            { label: 'تحتاج متابعة', value: failedJobs },
          ].map((stat) => (
            <div key={stat.label} className="rounded-[1.8rem] border border-[color:var(--line)] bg-white/5 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.22)]">
              <p className="text-[10px] tracking-[0.14em] text-[color:var(--muted)]">{stat.label}</p>
              <p className="mt-3 font-serif text-4xl text-[color:var(--foreground)]">{stat.value.toLocaleString('ar-SA')}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-[2.4rem] border border-[color:var(--line)] bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] shadow-[0_30px_100px_rgba(0,0,0,0.26)]">
        <div className="border-b border-white/10 px-6 py-5">
          <p className="text-[11px] tracking-[0.18em] text-[color:var(--accent)]">سجل المهام</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="text-start text-[11px] tracking-[0.14em] text-[color:var(--muted)]">
                <th className="px-6 py-4 font-medium">المهمة</th>
                <th className="px-6 py-4 font-medium">الحالة</th>
                <th className="px-6 py-4 font-medium">المستخدم</th>
                <th className="px-6 py-4 font-medium">الصيغة</th>
                <th className="px-6 py-4 font-medium">تاريخ الإنشاء</th>
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
                    <td className="job-time px-6 py-5 text-[color:var(--muted-strong)]">{formatDateTime(job.createdAt)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-6 py-8 text-[color:var(--muted)]" colSpan={5}>
                    لا توجد مهام بعد.
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
