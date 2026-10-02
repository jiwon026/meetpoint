import Link from "next/link";
import { LineBadge } from "@/components/ui/LineBadge";
import { Stamp } from "@/components/ui/Stamp";
import { CARD, PRIMARY_BUTTON } from "@/components/ui/styles";
import type { RecommendationOut } from "@/lib/api/types";
import { aboutMinutes } from "@/lib/format";
import { MSG_LEGS_MISSING, MSG_THEME_MATCH, msgSlowerThanBest } from "@/lib/messages";
import { FairnessStats } from "./FairnessStats";
import { LegBars } from "./LegBars";

type Props = {
  rec: RecommendationOut;
  rank: number;
  expanded: boolean;
  onToggle: () => void;
  best: number | null;
  mine: readonly number[];
  href: string;
};

export function HubCard({ rec, rank, expanded, onToggle, best, mine, href }: Props) {
  const extra = best === null ? 0 : rec.max_minutes - best;
  return (
    <article data-testid="hub-card" className={`${CARD} ${expanded ? "border-primary" : ""}`}>
      <button
        type="button"
        aria-expanded={expanded}
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
              {rank}
            </span>
            <span className="text-lg font-extrabold tracking-tight">{rec.name}</span>
            {rec.lines.map((line) => (
              <LineBadge key={line} line={line} />
            ))}
          </span>
          <span data-testid="hub-summary" className="mt-1 block text-sm text-ink-sub">
            {rec.region}, 최대 {aboutMinutes(rec.max_minutes)}, 차이 {rec.spread_minutes}분
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          {rank === 1 && <Stamp>1위</Stamp>}
          {rec.theme_match && <Stamp>{MSG_THEME_MATCH}</Stamp>}
        </span>
      </button>
      {expanded && (
        <div className="mt-4 space-y-4">
          {rec.tags.length > 0 && (
            <p className="flex flex-wrap gap-1.5 text-xs">
              {rec.tags.map((tag) => (
                <span key={tag} className="rounded bg-track px-1.5 py-0.5 text-ink-sub">
                  {tag}
                </span>
              ))}
            </p>
          )}
          {rec.vibe_summary && <p className="text-sm text-ink-sub">{rec.vibe_summary}</p>}
          {extra > 0 && <p className="text-sm font-semibold text-accent">{msgSlowerThanBest(extra)}</p>}
          {rec.legs.length === 0 ? (
            <p className="text-sm text-ink-mute">{MSG_LEGS_MISSING}</p>
          ) : (
            <>
              <FairnessStats legs={rec.legs} spread={rec.spread_minutes} />
              <LegBars legs={rec.legs} mine={mine} />
            </>
          )}
          <Link href={href} className={PRIMARY_BUTTON}>
            이 동네 둘러보기
          </Link>
        </div>
      )}
    </article>
  );
}
