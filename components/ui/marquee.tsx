import type { ComponentPropsWithoutRef, ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface MarqueeProps extends ComponentPropsWithoutRef<'div'> {
  className?: string;
  reverse?: boolean;
  pauseOnHover?: boolean;
  children: ReactNode;
  vertical?: boolean;
  repeat?: number;
}

export function Marquee({
  className,
  reverse = false,
  pauseOnHover = false,
  children,
  vertical = false,
  repeat = 4,
  ...props
}: MarqueeProps) {
  const sequence = Array.from({ length: repeat }, (_, index) => (
    <div
      key={index}
      className={cn('flex shrink-0 gap-[var(--gap)]', vertical ? 'flex-col' : 'flex-row')}
    >
      {children}
    </div>
  ));

  return (
    <div
      {...props}
      className={cn('group overflow-hidden p-2 [--duration:36s] [--gap:1rem]', className)}
    >
      <div
        className={cn(
          'flex w-max shrink-0 gap-[var(--gap)]',
          vertical ? 'animate-marquee-vertical flex-col' : 'animate-marquee flex-row',
          pauseOnHover && 'group-hover:[animation-play-state:paused]',
          reverse && '[animation-direction:reverse]'
        )}
        dir="ltr"
      >
        <div className={cn('flex min-w-full shrink-0 gap-[var(--gap)]', vertical ? 'flex-col' : 'flex-row')}>
          {sequence}
        </div>
        <div aria-hidden="true" className={cn('flex min-w-full shrink-0 gap-[var(--gap)]', vertical ? 'flex-col' : 'flex-row')}>
          {sequence}
        </div>
      </div>
    </div>
  );
}
