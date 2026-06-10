import { redirect } from 'next/navigation';

import { ProfilePanel } from '@/components/profile-panel';
import { getCurrentUser } from '@/lib/auth';
import { messages } from '@/lib/messages';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login?next=/profile' as never);
  }

  return (
    <div className="space-y-8">
      <section className="rounded-[2.5rem] border border-[color:var(--line)] bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-8 shadow-[0_30px_100px_rgba(0,0,0,0.26)]">
        <p className="text-[11px] tracking-[0.18em] text-[color:var(--accent)]">{messages.profilePage.eyebrow}</p>
        <h1 className="mt-4 font-serif text-5xl text-[color:var(--foreground)] sm:text-6xl">{user.name}</h1>
        <p className="mt-4 max-w-2xl text-sm leading-8 text-[color:var(--muted-strong)] sm:text-base">{messages.profilePage.description}</p>
      </section>

      <ProfilePanel userName={user.name} />
    </div>
  );
}
