import { Marquee } from '@/components/ui/marquee';
import { cn } from '@/lib/utils';

type PreviewModel = {
  title: string;
  caption: string;
  finish: string;
  hue: string;
};

const models: PreviewModel[] = [
  { title: 'كرسي الكثبان', caption: 'مسودة من صورة واحدة', finish: 'راتنج مطفأ', hue: 'from-[#f0d9b5] via-[#a88055] to-[#23170f]' },
  { title: 'مصباح المدار', caption: 'مجموعة متعددة الزوايا', finish: 'خيط لؤلؤي', hue: 'from-[#ddd6ff] via-[#7f7bdc] to-[#19152d]' },
  { title: 'وعاء الأرز', caption: 'غلاف يحافظ على الخامة', finish: 'حجر رملي', hue: 'from-[#ddc9aa] via-[#78573e] to-[#20150f]' },
  { title: 'مقعد اللولب', caption: 'ملف GLB جاهز للطباعة', finish: 'نايلون مطحون', hue: 'from-[#d5e5ef] via-[#6f96a8] to-[#15222a]' },
  { title: 'مقبض القوس', caption: 'دراسة تفصيلية', finish: 'شمع برونزي', hue: 'from-[#f2d198] via-[#9e6e2e] to-[#26170a]' },
  { title: 'طوطم الهضبة', caption: 'تصدير للعرض', finish: 'مركب طيني', hue: 'from-[#f4dcb2] via-[#b07b46] to-[#2b1b0c]' },
];

function PreviewCard({ title, caption, finish, hue }: PreviewModel) {
  return (
    <figure className="group relative w-[18rem] overflow-hidden rounded-[2rem] border border-white/10 bg-black/20 p-4 shadow-[0_20px_80px_rgba(0,0,0,0.28)] backdrop-blur-sm">
      <div className={cn('relative mb-4 aspect-[4/5] overflow-hidden rounded-[1.4rem] bg-gradient-to-br', hue)}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,0.35),transparent_30%)]" />
        <div className="absolute inset-x-[18%] bottom-[13%] top-[18%] rounded-[46%_54%_58%_42%/42%_42%_58%_58%] border border-white/20 bg-[linear-gradient(180deg,rgba(255,255,255,0.42),rgba(255,255,255,0.08))] shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_30px_50px_rgba(0,0,0,0.18)] transition-transform duration-500 group-hover:scale-[1.03] group-hover:rotate-2" />
        <div className="absolute inset-x-[28%] bottom-[8%] h-[12%] rounded-full bg-black/20 blur-xl" />
        <div className="absolute start-4 top-4 rounded-full border border-white/20 bg-black/20 px-3 py-1 text-[10px] tracking-[0.18em] text-white/80">
          مساحة عرض
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

export function ModelMarquee() {
  const exhibitionModels = models.slice(0, 5);

  return (
    <div className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] px-2 py-4 shadow-[0_30px_100px_rgba(0,0,0,0.28)]">
      <div className="mb-4 px-6 pt-4">
        <p className="text-[11px] tracking-[0.18em] text-[color:var(--accent)]">جدار العرض</p>
        <h2 className="mt-3 max-w-2xl font-serif text-3xl text-[color:var(--foreground)] sm:text-4xl">
          معاينات جاهزة للمشاهدة.
        </h2>
      </div>
      <Marquee pauseOnHover className="[--duration:32s]">
        {exhibitionModels.map((model) => (
          <PreviewCard key={model.title} {...model} />
        ))}
      </Marquee>
      <div className="pointer-events-none absolute inset-y-0 start-0 w-28 bg-gradient-to-l from-[color:var(--background)] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 end-0 w-28 bg-gradient-to-r from-[color:var(--background)] to-transparent" />
    </div>
  );
}
