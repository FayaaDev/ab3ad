import { shouldTreatAsAdmin } from '@/lib/auth-utils';
import { getCurrentUser } from '@/lib/auth';
import { ProfileMenu } from '@/components/profile-menu';
import { messages } from '@/lib/messages';

export async function SiteHeader() {
  const user = await getCurrentUser();
  const links = user && shouldTreatAsAdmin(user) ? [{ href: '/admin', label: messages.siteHeader.admin }] : [];

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[rgba(7,8,14,0.72)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-4 lg:px-8">
        <div className="space-y-1">
          <a className="inline-flex items-baseline gap-3" href="/">
            <span className="font-serif text-3xl tracking-[0.18em] text-[color:var(--foreground)]">أبعاد</span>
            <span className="text-[10px] tracking-[0.18em] text-[color:var(--muted)]">{messages.siteHeader.brandTag}</span>
          </a>
          <p className="max-w-md text-xs leading-6 text-[color:var(--muted)]">{messages.siteHeader.tagline}</p>
        </div>

        <nav className="flex flex-wrap items-center gap-2">
          {links.map((link) => (
            <a key={link.href} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs tracking-[0.14em] text-[color:var(--foreground)] transition-colors hover:bg-white/10" href={link.href}>
              {link.label}
            </a>
          ))}
          {user ? (
            <>
              <ProfileMenu userName={user.name} />
              <form action="/api/auth/logout" method="post">
                <button className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs tracking-[0.14em] text-[color:var(--foreground)] transition-colors hover:bg-white/10" type="submit">
                  {messages.siteHeader.logout}
                </button>
              </form>
            </>
          ) : (
            <a className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs tracking-[0.14em] text-[color:var(--foreground)] transition-colors hover:bg-white/10" href="/login?next=/">
              {messages.siteHeader.login}
            </a>
          )}
        </nav>
      </div>
    </header>
  );
}
