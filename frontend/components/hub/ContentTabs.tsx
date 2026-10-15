"use client";

import { useEffect, useState } from "react";
import { KakaoMap } from "@/components/map/KakaoMap";
import { Chip } from "@/components/ui/Chip";
import { track } from "@/lib/analytics";
import { useHubContent } from "@/lib/api/hooks";
import type { EventItem, Place } from "@/lib/api/types";
import { MSG_LOADING, MSG_NOTHING_NEARBY, MSG_SORT_NOTE } from "@/lib/messages";
import { DEFAULT_PLACE_SORT, isSortable, PLACE_SORTS, type PlaceSort } from "@/lib/placeSort";
import { CONTENT_TABS, type ContentKind } from "@/lib/themes";
import { EventCard } from "./EventCard";
import { PlaceCard } from "./PlaceCard";

type Props = {
  slug: string;
  hubId: number;
  initial: ContentKind;
  center: { lat: number; lng: number };
  onGone: () => void;
};

export function ContentTabs({ slug, hubId, initial, center, onGone }: Props) {
  const [kind, setKind] = useState<ContentKind>(initial);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sort, setSort] = useState<PlaceSort>(DEFAULT_PLACE_SORT);
  const content = useHubContent(slug, hubId, kind, sort);
  const gone = content.error?.status === 404;

  useEffect(() => {
    if (gone) onGone();
  }, [gone, onGone]);

  // items의 모양은 lib/api/types.ts의 Place, EventItem 주석 참고.
  const items = content.data?.items ?? [];
  const places = kind === "event" ? [] : (items as unknown as Place[]);
  const events = kind === "event" ? (items as unknown as EventItem[]) : [];
  const pins = [...places, ...events].map((item, index) => ({
    id: item.id,
    lat: item.lat,
    lng: item.lng,
    label: String(index + 1),
  }));

  const select = (next: ContentKind) => {
    if (next !== kind) track("content_tab_selected", { kind: next });
    setActiveId(null);
    setKind(next);
  };

  const reorder = (next: PlaceSort) => {
    // 정렬 칩은 맛집, 카페, 술자리 탭에만 보인다.
    if (next !== sort && (kind === "food" || kind === "cafe" || kind === "drink")) track("place_sort_changed", { kind, sort: next });
    setActiveId(null);
    setSort(next);
  };

  // 정렬을 고르지 않는 놀거리는 기본 정렬로 남긴다.
  const linkClicked = (position: number) => {
    if (kind === "event") return;
    track("place_link_clicked", { kind, sort: isSortable(kind) ? sort : DEFAULT_PLACE_SORT, position });
  };

  return (
    <section className="space-y-3">
      <div role="tablist" aria-label="주변 종류" data-tour="tabs" className="grid grid-cols-5 gap-1 rounded-lg bg-track p-1">
        {CONTENT_TABS.map((tab) => (
          <button
            key={tab.kind}
            type="button"
            role="tab"
            aria-selected={kind === tab.kind}
            onClick={() => select(tab.kind)}
            className={`rounded-md py-2 text-sm font-semibold ${kind === tab.kind ? "bg-card text-primary" : "text-ink-sub"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {isSortable(kind) && (
        <div className="space-y-1.5">
          <div role="group" aria-label="정렬" className="flex gap-2">
            {PLACE_SORTS.map((option) => (
              <Chip key={option.id} selected={sort === option.id} onClick={() => reorder(option.id)}>
                {option.label}
              </Chip>
            ))}
          </div>
          {sort === "recommended" && <p className="text-xs text-ink-mute">{MSG_SORT_NOTE}</p>}
        </div>
      )}
      <KakaoMap pins={pins} activeId={activeId} center={center} level={4} />
      {content.isPending && <p className="py-6 text-center text-ink-mute">{MSG_LOADING}</p>}
      {content.error && !gone && (
        <p role="alert" className="text-sm font-semibold text-accent">
          {content.error.message}
        </p>
      )}
      {content.data?.error && <p className="text-sm font-semibold text-accent">{content.data.error}</p>}
      {content.data && !content.data.error && items.length === 0 && (
        <p className="py-6 text-center text-ink-mute">{MSG_NOTHING_NEARBY}</p>
      )}
      <ul className="space-y-2">
        {places.map((place, index) => (
          <li key={place.id}>
            <PlaceCard
              place={place}
              kind={kind === "event" ? "food" : kind}
              index={index}
              active={place.id === activeId}
              onSelect={() => setActiveId(place.id)}
              onLinkClick={() => linkClicked(index + 1)}
            />
          </li>
        ))}
        {events.map((event) => (
          <li key={event.id}>
            <EventCard event={event} />
          </li>
        ))}
      </ul>
    </section>
  );
}
