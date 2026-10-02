"use client";

import { useEffect, useState } from "react";
import { KakaoMap } from "@/components/map/KakaoMap";
import { useHubContent } from "@/lib/api/hooks";
import type { EventItem, Place } from "@/lib/api/types";
import { MSG_LOADING, MSG_NOTHING_NEARBY } from "@/lib/messages";
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
  const content = useHubContent(slug, hubId, kind);
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
    setActiveId(null);
    setKind(next);
  };

  return (
    <section className="space-y-3">
      <div role="tablist" aria-label="주변 종류" className="grid grid-cols-4 gap-1 rounded-lg bg-track p-1">
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
            <PlaceCard place={place} index={index} active={place.id === activeId} onSelect={() => setActiveId(place.id)} />
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
