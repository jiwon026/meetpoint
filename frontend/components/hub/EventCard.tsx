import { CARD } from "@/components/ui/styles";
import type { EventItem } from "@/lib/api/types";

export function EventCard({ event }: { event: EventItem }) {
  return (
    <article className={`${CARD} flex gap-3`}>
      {event.image && (
        // 포스터는 외부 주소라 next/image 대신 img를 쓴다 (허용 도메인을 미리 알 수 없다).
        // eslint-disable-next-line @next/next/no-img-element
        <img src={event.image} alt="" loading="lazy" className="h-24 w-[72px] shrink-0 rounded-lg object-cover" />
      )}
      <div className="min-w-0 space-y-1">
        <p className="font-bold">{event.title}</p>
        <p className="truncate text-sm text-ink-sub">{event.place}</p>
        <p className="text-sm text-ink-mute">
          {event.start_date} ~ {event.end_date}
        </p>
        <p className="flex flex-wrap items-center gap-1.5 text-xs">
          {event.category && <span className="rounded bg-track px-1.5 py-0.5 text-ink-sub">{event.category}</span>}
          {event.is_free && <span className="rounded bg-primary-tint px-1.5 py-0.5 font-bold text-primary">무료</span>}
        </p>
        {event.url && (
          <a href={event.url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-primary underline">
            자세히 보기
          </a>
        )}
      </div>
    </article>
  );
}
