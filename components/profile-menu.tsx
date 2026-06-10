'use client';

import { User2 } from 'lucide-react';
import { messages } from '@/lib/messages';

export function ProfileMenu({ userName }: { userName: string }) {
  const label = `${messages.siteHeader.profile}: ${userName}`;

  return (
    <a
      aria-label={label}
      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs tracking-[0.14em] text-[color:var(--foreground)] transition-colors hover:bg-white/10"
      href="/profile"
    >
      <User2 className="size-4" />
      {messages.siteHeader.profile}
    </a>
  );
}
