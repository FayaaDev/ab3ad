import freelanceLogo from '@/assets/logo/freelance.png';

import { messages } from '@/lib/messages';

export function SiteBadges() {
  return (
    <div className="mx-auto mt-8 flex max-w-7xl justify-end gap-3 px-6 pb-8 lg:px-8">
      <a
        href="https://wa.me/966507863400"
        target="_blank"
        rel="noreferrer"
        aria-label={messages.siteBadges.whatsappLabel}
        className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-[color:var(--line)] bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] text-[color:var(--accent)] shadow-[0_24px_80px_rgba(0,0,0,0.24)] transition hover:bg-white/10"
      >
        <WhatsAppLogo className="size-6" />
      </a>
      <a
        href="/assets/logo/certificate.pdf"
        target="_blank"
        rel="noreferrer"
        aria-label={messages.siteBadges.certificateLabel}
        className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-[color:var(--line)] bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-2 shadow-[0_24px_80px_rgba(0,0,0,0.24)] transition hover:bg-white/10"
      >
        <img src={freelanceLogo.src} alt="freelance.sa" className="h-10 w-10" />
      </a>
    </div>
  );
}

function WhatsAppLogo({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M19.05 4.91A9.82 9.82 0 0 0 12.03 2C6.61 2 2.2 6.41 2.2 11.83c0 1.73.45 3.43 1.32 4.93L2 22l5.39-1.41a9.8 9.8 0 0 0 4.64 1.18h.01c5.42 0 9.83-4.41 9.83-9.83a9.76 9.76 0 0 0-2.82-7.03Zm-7.02 15.2h-.01a8.16 8.16 0 0 1-4.16-1.14l-.3-.18-3.2.84.85-3.12-.2-.32a8.16 8.16 0 0 1-1.26-4.35c0-4.5 3.66-8.16 8.17-8.16 2.18 0 4.23.85 5.77 2.39a8.12 8.12 0 0 1 2.39 5.77c0 4.5-3.67 8.17-8.05 8.17Zm4.47-6.12c-.24-.12-1.4-.69-1.62-.77-.22-.08-.38-.12-.54.12-.16.24-.62.77-.76.93-.14.16-.28.18-.52.06-.24-.12-1.02-.38-1.94-1.22-.72-.64-1.2-1.43-1.34-1.67-.14-.24-.01-.37.11-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.2-.48-.4-.41-.54-.42l-.46-.01c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.7 2.6 4.12 3.65.58.25 1.03.4 1.38.52.58.18 1.1.16 1.52.1.46-.07 1.4-.57 1.6-1.12.2-.55.2-1.02.14-1.12-.06-.1-.22-.16-.46-.28Z" />
    </svg>
  );
}
