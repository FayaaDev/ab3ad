import { ModelMarquee } from '@/components/model-marquee';
import { UploadForm } from '@/components/upload-form';
import { getCurrentUser } from '@/lib/auth';
import { messages } from '@/lib/messages';

export default async function HomePage() {
  const user = await getCurrentUser();

  return (
    <div className="space-y-6 lg:space-y-8">
      <section id="exhibition-wall">
        <ModelMarquee />
      </section>

      <section
        id="upload-studio"
        className="rounded-[2.4rem] border border-[color:var(--line)] bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-4 shadow-[0_28px_90px_rgba(0,0,0,0.24)] sm:p-5"
      >
        {user ? (
          <UploadForm />
        ) : (
          <div className="space-y-4 rounded-[2rem] border border-[color:var(--line)] bg-black/20 p-6 text-center">
            <p className="text-sm text-[color:var(--muted)]">{messages.home.loginPrompt}</p>
            <a className="inline-flex rounded-full border border-white/10 bg-white/10 px-5 py-3 text-sm text-white" href="/login?next=/">
              {messages.home.loginCta}
            </a>
          </div>
        )}
      </section>
    </div>
  );
}
