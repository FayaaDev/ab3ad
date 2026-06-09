import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';

import { cn } from '@/lib/utils';

interface BentoGridProps extends ComponentPropsWithoutRef<'div'> {
  children: ReactNode;
}

interface BentoCardProps extends ComponentPropsWithoutRef<'div'> {
  name: string;
  className?: string;
  background: ReactNode;
  Icon: React.ElementType;
  description: string;
  href: string;
  cta: string;
}

export function BentoGrid({ children, className, ...props }: BentoGridProps) {
  return (
    <div className={cn('grid w-full auto-rows-[24rem] grid-cols-1 gap-5 lg:grid-cols-3', className)} {...props}>
      {children}
    </div>
  );
}

export function BentoCard({
  name,
  className,
  background,
  Icon,
  description,
  href,
  cta,
  ...props
}: BentoCardProps) {
  return (
    <div
      className={cn(
        'group relative col-span-1 overflow-hidden rounded-[2rem] border border-[color:var(--line)] bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] shadow-[0_30px_100px_rgba(0,0,0,0.28)] lg:col-span-1',
        className
      )}
      {...props}
    >
      <div className="absolute inset-0">{background}</div>
      <div className="relative flex h-full flex-col justify-between p-6">
        <div className="space-y-4">
          <div className="flex size-14 items-center justify-center rounded-full border border-white/10 bg-black/20 text-[color:var(--accent)] backdrop-blur-sm transition-transform duration-500 group-hover:scale-90">
            <Icon className="size-6" />
          </div>
          <div className="space-y-2">
            <h3 className="font-serif text-2xl text-[color:var(--foreground)]">{name}</h3>
            <p className="max-w-sm text-sm leading-6 text-[color:var(--muted)]">{description}</p>
          </div>
        </div>

        <a
          className="inline-flex items-center gap-2 text-sm tracking-[0.14em] text-[color:var(--accent)] transition-transform duration-300 group-hover:-translate-x-1"
          href={href}
        >
          <span>{cta}</span>
          <ArrowLeft className="size-4" />
        </a>
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.14),transparent_32%)] opacity-70 transition-opacity duration-500 group-hover:opacity-100" />
    </div>
  );
}
