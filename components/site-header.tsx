const links = [
  { href: '/', label: 'المعرض' },
  { href: '/admin', label: 'الأرشيف' },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[rgba(7,8,14,0.72)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-4 lg:px-8">
        <div className="space-y-1">
          <a className="inline-flex items-baseline gap-3" href="/">
            <span className="font-serif text-3xl tracking-[0.18em] text-[color:var(--foreground)]">ab3ad</span>
            <span className="text-[10px] tracking-[0.18em] text-[color:var(--muted)]">مشغل النماذج</span>
          </a>
          <p className="max-w-md text-xs leading-6 text-[color:var(--muted)]">
            تحويل الصور إلى نماذج ثلاثية الأبعاد بعناية، للدراسات التصميمية والمفاهيم والقطع القابلة للطباعة.
          </p>
        </div>

        <nav className="flex flex-wrap items-center gap-2">
          {links.map((link) => (
            <a
              key={link.href}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs tracking-[0.14em] text-[color:var(--foreground)] transition-colors hover:bg-white/10"
              href={link.href}
            >
              {link.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}
