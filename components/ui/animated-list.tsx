'use client';

import { Children, memo, useEffect, useMemo, useState, type ComponentPropsWithoutRef, type ReactElement, type ReactNode } from 'react';
import { AnimatePresence, motion, type MotionProps } from 'motion/react';

import { cn } from '@/lib/utils';

export function AnimatedListItem({ children }: { children: ReactNode }) {
  const animations: MotionProps = {
    initial: { scale: 0.98, opacity: 0 },
    animate: { scale: 1, opacity: 1, originY: 0 },
    exit: { scale: 0.98, opacity: 0 },
    transition: { type: 'spring', stiffness: 350, damping: 35 },
  };

  return (
    <motion.div {...animations} layout className="mx-auto w-full">
      {children}
    </motion.div>
  );
}

export interface AnimatedListProps extends ComponentPropsWithoutRef<'div'> {
  children: ReactNode;
  delay?: number;
}

export const AnimatedList = memo(function AnimatedList({ children, className, delay = 0, ...props }: AnimatedListProps) {
  const [index, setIndex] = useState(delay > 0 ? 0 : Number.POSITIVE_INFINITY);
  const childrenArray = useMemo(() => Children.toArray(children), [children]);

  useEffect(() => {
    if (delay <= 0) {
      setIndex(Number.POSITIVE_INFINITY);
      return;
    }

    setIndex(0);
  }, [childrenArray, delay]);

  useEffect(() => {
    if (delay <= 0 || index >= childrenArray.length - 1) {
      return;
    }

    const timeout = setTimeout(() => {
      setIndex((currentIndex) => currentIndex + 1);
    }, delay);

    return () => clearTimeout(timeout);
  }, [childrenArray.length, delay, index]);

  const itemsToShow = useMemo(() => {
    if (delay <= 0) {
      return childrenArray;
    }

    return childrenArray.slice(0, index + 1);
  }, [childrenArray, delay, index]);

  return (
    <div className={cn('flex flex-col gap-2', className)} {...props}>
      <AnimatePresence initial={false}>
        {itemsToShow.map((item, itemIndex) => (
          <AnimatedListItem key={(item as ReactElement).key ?? itemIndex}>{item}</AnimatedListItem>
        ))}
      </AnimatePresence>
    </div>
  );
});
