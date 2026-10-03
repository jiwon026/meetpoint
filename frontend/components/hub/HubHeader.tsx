import { LineBadge } from "@/components/ui/LineBadge";
import { CARD } from "@/components/ui/styles";
import type { RecommendationOut } from "@/lib/api/types";

export function HubHeader({ rec }: { rec: RecommendationOut }) {
  return (
    <section className={`${CARD} space-y-2`}>
      <div className="flex flex-wrap items-center gap-1.5">
        <h1 className="text-xl font-extrabold tracking-tight">{rec.name}</h1>
        {rec.lines.map((line) => (
          <LineBadge key={line} line={line} />
        ))}
      </div>
      {rec.vibe_summary && <p className="text-sm text-ink-sub">{rec.vibe_summary}</p>}
      <p className="flex flex-wrap gap-1.5 text-xs">
        <span className="rounded bg-primary-tint px-1.5 py-0.5 font-semibold text-primary">{rec.region}</span>
        <span className="rounded bg-primary-tint px-1.5 py-0.5 font-semibold text-primary">반경 600m</span>
        {rec.tags.map((tag) => (
          <span key={tag} className="rounded bg-track px-1.5 py-0.5 text-ink-sub">
            {tag}
          </span>
        ))}
      </p>
    </section>
  );
}
