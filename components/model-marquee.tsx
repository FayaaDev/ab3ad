'use client';

import Script from 'next/script';
import { createElement, useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

type PreviewModel = {
  title: string;
  caption: string;
  finish: string;
  src: string;
};

const models: PreviewModel[] = [
  {
    title: 'عبدو',
    caption: 'نموذج واقعي من الأصول المحلية',
    finish: 'GLB جاهز',
    src: '/api/assets/samples/Abdo-Hitem3d.glb',
  },
  {
    title: 'أليسا',
    caption: 'معاينة تفاعلية داخل جدار العرض',
    finish: 'ملف أصلي',
    src: '/api/assets/samples/Alisa.glb',
  },
  {
    title: 'دابريني',
    caption: 'عرض مباشر بدل البطاقات الوهمية',
    finish: 'تفاصيل كاملة',
    src: '/api/assets/samples/dabbrini.glb',
  },
  {
    title: 'ساجر',
    caption: 'دوران تلقائي لإبراز المجسم',
    finish: 'جاهز للاستعراض',
    src: '/api/assets/samples/Sager-Hitem3d.glb',
  },
  {
    title: 'طلال',
    caption: 'يُحمّل من مجلد assets مباشرة',
    finish: 'أصل محلي',
    src: '/api/assets/samples/Talal-Hitem3d.glb',
  },
];

function PreviewCard({ title, caption, finish, src }: PreviewModel) {
  return (
    <figure
      dir="rtl"
      className="group relative w-[20rem] shrink-0 overflow-hidden rounded-[2rem] border border-white/10 bg-black/20 p-4 shadow-[0_20px_80px_rgba(0,0,0,0.28)] backdrop-blur-sm"
    >
      <div className="relative mb-4 aspect-[4/5] overflow-hidden rounded-[1.4rem] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),rgba(255,255,255,0.02)_38%,rgba(0,0,0,0.4))]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(255,255,255,0.18),transparent_28%)]" />
        {createElement('model-viewer', {
          src,
          alt: title,
          className:
            'block h-full w-full bg-transparent [--poster-color:transparent] transition-transform duration-500 group-hover:scale-[1.02]',
          loading: 'eager',
          reveal: 'auto',
          interactionPrompt: 'none',
          shadowIntensity: '1',
          exposure: '1',
          cameraOrbit: '0deg 75deg auto',
          minCameraOrbit: 'auto 55deg auto',
          maxCameraOrbit: 'auto 95deg auto',
          disableZoom: true,
          ar: false,
          autoplay: true,
          'camera-controls': true,
          'auto-rotate': true,
          'rotation-per-second': '18deg',
        })}
        <div className="pointer-events-none absolute start-4 top-4 rounded-full border border-white/20 bg-black/30 px-3 py-1 text-[10px] tracking-[0.18em] text-white/80">
          أصل من assets
        </div>
      </div>
      <figcaption className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-serif text-xl text-[color:var(--foreground)]">{title}</h3>
          <span className="text-[10px] tracking-[0.14em] text-[color:var(--accent)]">{finish}</span>
        </div>
        <p className="text-sm text-[color:var(--muted)]">{caption}</p>
      </figcaption>
    </figure>
  );
}

function MarqueeTrack({ pauseOnHover = true }: { pauseOnHover?: boolean }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const firstSequenceRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);
  const pausedRef = useRef(false);
  const [sequenceWidth, setSequenceWidth] = useState(0);

  useEffect(() => {
    const measure = () => {
      setSequenceWidth(firstSequenceRef.current?.scrollWidth ?? 0);
    };

    measure();
    window.addEventListener('resize', measure);

    return () => {
      window.removeEventListener('resize', measure);
    };
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || sequenceWidth === 0) {
      return;
    }

    const pixelsPerSecond = 48;

    const step = (timestamp: number) => {
      if (lastTimestampRef.current === null) {
        lastTimestampRef.current = timestamp;
      }

      const delta = timestamp - lastTimestampRef.current;
      lastTimestampRef.current = timestamp;

      if (!pausedRef.current) {
        viewport.scrollLeft += (pixelsPerSecond * delta) / 1000;

        if (viewport.scrollLeft >= sequenceWidth) {
          viewport.scrollLeft -= sequenceWidth;
        }
      }

      animationFrameRef.current = window.requestAnimationFrame(step);
    };

    viewport.scrollLeft = 0;
    animationFrameRef.current = window.requestAnimationFrame(step);

    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
      animationFrameRef.current = null;
      lastTimestampRef.current = null;
    };
  }, [sequenceWidth]);

  const handlePointerEnter = () => {
    if (pauseOnHover) {
      pausedRef.current = true;
    }
  };

  const handlePointerLeave = () => {
    pausedRef.current = false;
  };

  const cards = models.map((model, index) => <PreviewCard key={`${model.title}-${index}`} {...model} />);

  return (
    <div
      ref={viewportRef}
      className="overflow-x-hidden p-2"
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
    >
      <div className="flex w-max gap-4" dir="ltr">
        <div ref={firstSequenceRef} className={cn('flex shrink-0 gap-4')}>
          {cards}
        </div>
        <div aria-hidden="true" className={cn('flex shrink-0 gap-4')}>
          {models.map((model, index) => (
            <PreviewCard key={`${model.title}-clone-${index}`} {...model} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function ModelMarquee() {
  return (
    <>
      <Script
        type="module"
        src="https://ajax.googleapis.com/ajax/libs/model-viewer/4.1.0/model-viewer.min.js"
        strategy="afterInteractive"
      />
      <div className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] px-2 py-4 shadow-[0_30px_100px_rgba(0,0,0,0.28)]">
        <div className="mb-4 px-6 pt-4">
          <p className="text-[11px] tracking-[0.18em] text-[color:var(--accent)]">جدار العرض</p>
          <h2 className="mt-3 max-w-2xl font-serif text-3xl text-[color:var(--foreground)] sm:text-4xl">
            معاينات فعلية من الأصول المحلية.
          </h2>
        </div>
        <MarqueeTrack />
        <div className="pointer-events-none absolute inset-y-0 start-0 w-28 bg-gradient-to-l from-[color:var(--background)] to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 end-0 w-28 bg-gradient-to-r from-[color:var(--background)] to-transparent" />
      </div>
    </>
  );
}
