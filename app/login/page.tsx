import { redirect } from 'next/navigation';
import { AuthPanel } from '@/components/auth-panel';
import { getCurrentUser } from '@/lib/auth';

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect('/');
  }

  return (
    <div className="space-y-6">
      <section className="mx-auto max-w-3xl space-y-4 text-center">
        <p className="text-[11px] tracking-[0.18em] text-[color:var(--accent)]">دخول آمن</p>
        <h1 className="font-serif text-5xl text-[color:var(--foreground)] sm:text-6xl">سجّل الدخول قبل معالجة صور Hi3D الحقيقية.</h1>
        <p className="text-sm leading-8 text-[color:var(--muted-strong)] sm:text-base">يحفظ ab3ad الملفات والمهام والنتائج ضمن حسابك فقط، ويقصر الوصول الإداري على المشغلين المصرّح لهم.</p>
      </section>
      <AuthPanel />
    </div>
  );
}
