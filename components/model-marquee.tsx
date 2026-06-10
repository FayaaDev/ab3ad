'use client';

import Script from 'next/script';
import { createElement } from 'react';

import { Marquee } from '@/components/ui/marquee';
import { messages } from '@/lib/messages';

type PreviewModel = {
  title: string;
  caption: string;
  finish?: string;
  src: string;
};

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
            'pointer-events-none block h-full w-full select-none bg-transparent [--poster-color:transparent] transition-transform duration-500 group-hover:scale-[1.02]',
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
          'auto-rotate': true,
          'rotation-per-second': '18deg',
        })}
        <div className="pointer-events-none absolute start-4 top-4 rounded-full border border-white/20 bg-black/30 px-3 py-1 text-[10px] tracking-[0.18em] text-white/80">
          {messages.modelMarquee.assetBadge}
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

export function ModelMarquee({ models }: { models: PreviewModel[] }) {
  return (
    <>
      <Script
        type="module"
        src="https://ajax.googleapis.com/ajax/libs/model-viewer/4.1.0/model-viewer.min.js"
        strategy="afterInteractive"
      />
      <div className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] px-2 py-4 shadow-[0_30px_100px_rgba(0,0,0,0.28)]">
        <div className="mb-4 px-6 pt-4">
          <p className="text-[11px] tracking-[0.18em] text-[color:var(--accent)]">{messages.modelMarquee.eyebrow}</p>
          <h2 className="mt-3 max-w-2xl font-serif text-3xl text-[color:var(--foreground)] sm:text-4xl">
            {messages.modelMarquee.title}
          </h2>
        </div>
        <Marquee pauseOnHover className="[--duration:80s] [--gap:1rem]" repeat={4}>
          {models.map((model, index) => (
            <PreviewCard key={`${model.title}-${index}`} {...model} />
          ))}
        </Marquee>
        <div className="pointer-events-none absolute inset-y-0 start-0 w-28 bg-gradient-to-l from-[color:var(--background)] to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 end-0 w-28 bg-gradient-to-r from-[color:var(--background)] to-transparent" />
      </div>
    </>
  );
}
