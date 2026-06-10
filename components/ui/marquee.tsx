'use client';

import { useEffect, useRef, useState } from 'react';
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
  repeat = 1,
  ...props
}: MarqueeProps) {
  const directionClassName = vertical ? 'flex-col' : 'flex-row';
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [autoRepeat, setAutoRepeat] = useState(repeat);

  useEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;

    if (!container || !measure || typeof ResizeObserver === 'undefined') {
      return;
    }

    const updateRepeat = () => {
      const viewportSize = vertical ? container.clientHeight : container.clientWidth;
      const contentSize = vertical ? measure.scrollHeight : measure.scrollWidth;

      if (!viewportSize || !contentSize) {
        return;
      }

      setAutoRepeat(Math.max(repeat, Math.ceil(viewportSize / contentSize)));
    };

    updateRepeat();

    const resizeObserver = new ResizeObserver(() => updateRepeat());
    resizeObserver.observe(container);
    resizeObserver.observe(measure);

    return () => {
      resizeObserver.disconnect();
    };
  }, [repeat, vertical, children]);

  const renderSequence = (sequenceKey: string) =>
    Array.from({ length: autoRepeat }, (_, index) => (
      <div
        key={`${sequenceKey}-${index}`}
        className={cn('flex shrink-0 gap-[var(--gap)]', directionClassName)}
      >
        {children}
      </div>
    ));

  return (
    <div
      {...props}
      ref={containerRef}
      className={cn('group relative overflow-hidden p-2 [--duration:36s] [--gap:1rem]', className)}
    >
      <div
        ref={measureRef}
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute flex shrink-0 gap-[var(--gap)] opacity-0',
          directionClassName
        )}
      >
        {children}
      </div>
      <div className="flex w-full justify-start" dir="ltr">
        <div
          className={cn(
            'flex w-max shrink-0 [will-change:transform]',
            vertical ? 'animate-marquee-vertical flex-col' : 'animate-marquee flex-row',
            pauseOnHover && 'group-hover:[animation-play-state:paused]',
            reverse && '[animation-direction:reverse]'
          )}
        >
          <div className={cn('flex shrink-0 gap-[var(--gap)]', directionClassName)}>
            {renderSequence('primary')}
          </div>
          <div aria-hidden="true" className={cn('flex shrink-0 gap-[var(--gap)]', directionClassName)}>
            {renderSequence('clone')}
          </div>
        </div>
      </div>
    </div>
  );
}
