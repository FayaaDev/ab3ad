import { ModelMarquee } from '@/components/model-marquee';
import { UploadForm } from '@/components/upload-form';

export default function HomePage() {
  return (
    <div className="space-y-6 lg:space-y-8">
      <section id="exhibition-wall">
        <ModelMarquee />
      </section>

      <section
        id="upload-studio"
        className="rounded-[2.4rem] border border-[color:var(--line)] bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-4 shadow-[0_28px_90px_rgba(0,0,0,0.24)] sm:p-5"
      >
        <UploadForm />
      </section>
    </div>
  );
}
