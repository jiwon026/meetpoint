import { CARD } from "@/components/ui/styles";
import type { Place } from "@/lib/api/types";
import { walkMinutes } from "@/lib/format";

type Props = { place: Place; index: number; active: boolean; onSelect: () => void };

export function PlaceCard({ place, index, active, onSelect }: Props) {
  return (
    <article className={`${CARD} ${active ? "border-primary" : ""}`}>
      <button type="button" onClick={onSelect} className="flex w-full items-start gap-3 text-left">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
          {index + 1}
        </span>
        <span className="min-w-0">
          <span className="block truncate font-bold">{place.name}</span>
          <span className="block text-sm text-ink-sub">
            {place.category ? `${place.category}, ` : ""}
            <span className="font-semibold text-primary">도보 약 {walkMinutes(place.distance_m)}분</span>
          </span>
          <span className="block truncate text-sm text-ink-mute">{place.address}</span>
        </span>
      </button>
      <a
        href={place.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-block text-sm font-semibold text-primary underline"
      >
        카카오맵에서 별점, 리뷰 보기
      </a>
    </article>
  );
}
