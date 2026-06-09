import { JobStatus } from '@/components/job-status';

export default async function JobPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;

  return (
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[2.5rem] border border-[color:var(--line)] bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-8 shadow-[0_30px_100px_rgba(0,0,0,0.26)]">
          <p className="text-[11px] tracking-[0.18em] text-[color:var(--accent)]">تقدّم المهمة</p>
          <h1 className="mt-4 font-serif text-5xl text-[color:var(--foreground)] sm:text-6xl">تابع سجل التوليد لحظة بلحظة.</h1>
          <p className="mt-4 max-w-2xl text-sm leading-8 text-[color:var(--muted-strong)] sm:text-base">
            نعرض الإرسال، ومعالجة Hi3D، والاستدعاءات الراجعة، وتنزيل النتيجة كسجل أحداث واضح بدلًا من عرض خام للطابور.
          </p>
        </div>

        <aside className="rounded-[2.5rem] border border-[color:var(--line)] bg-white/5 p-6 shadow-[0_30px_100px_rgba(0,0,0,0.26)]">
          <p className="text-[11px] tracking-[0.18em] text-[color:var(--accent)]">مرجع</p>
          <div className="mt-5 space-y-4">
            <div className="rounded-[1.6rem] border border-white/10 bg-black/20 p-4">
              <p className="text-[10px] tracking-[0.14em] text-[color:var(--muted)]">معرّف المهمة</p>
              <p className="job-time mt-3 text-sm leading-6 text-[color:var(--foreground)]">{jobId}</p>
            </div>
            <div className="rounded-[1.6rem] border border-white/10 bg-black/20 p-4">
              <p className="text-[10px] tracking-[0.14em] text-[color:var(--muted)]">المخرجات المتوقعة</p>
              <p className="mt-3 text-sm leading-6 text-[color:var(--foreground)]">ملف نتيجة محفوظ، وسجل أحداث، ومسار للاستعادة عند الفشل، وملف GLB قابل للتنزيل عند الجاهزية.</p>
            </div>
          </div>
        </aside>
      </section>

      <JobStatus jobId={jobId} />
    </div>
  );
}
