"use client";

import Link from "next/link";
import { useState } from "react";
import { ShareButtons } from "@/components/join/ShareButtons";
import { StickyAction } from "@/components/ui/StickyAction";
import { useToast } from "@/components/ui/Toast";
import { CARD, PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/ui/styles";
import { useResult } from "@/lib/api/hooks";
import { SERVICE_NAME } from "@/lib/constants";
import { filterQuery, type ResultFilter } from "@/lib/filter";
import {
  MSG_LINK_COPIED,
  MSG_LINK_COPY_FAILED,
  MSG_LOADING,
  MSG_NEED_TWO,
  MSG_NO_HUB_IN_REGION,
  MSG_NO_ROUTE,
} from "@/lib/messages";
import { readMine } from "@/lib/myParticipants";
import { isAllRegions } from "@/lib/regions";
import { copyText } from "@/lib/share";
import { FilterBar } from "./FilterBar";
import { HubCard } from "./HubCard";

type Props = {
  slug: string;
  filter: ResultFilter;
  onFilterChange: (next: ResultFilter) => void;
  onAddPeople: () => void;
};

export function ResultScreen({ slug, filter, onFilterChange, onAddPeople }: Props) {
  const result = useResult(slug, filter);
  const [openId, setOpenId] = useState<number | null>(null);
  const [mine] = useState(() => readMine(slug));
  const toast = useToast();

  if (!result.data) {
    if (result.error) {
      return (
        <section role="alert" className={`${CARD} space-y-4 text-center`}>
          <p className="font-semibold">{result.error.message}</p>
          <Link href="/" className={PRIMARY_BUTTON}>
            새 방 만들기
          </Link>
        </section>
      );
    }
    return <p className="py-10 text-center text-ink-mute">{MSG_LOADING}</p>;
  }

  const data = result.data;
  if (data.status === "waiting") {
    return (
      <section className={`${CARD} space-y-4 text-center`}>
        <p className="font-bold">{MSG_NEED_TWO}</p>
        <ShareButtons slug={slug} title={SERVICE_NAME} />
        <button type="button" onClick={onAddPeople} className={PRIMARY_BUTTON}>
          사람 추가
        </button>
      </section>
    );
  }

  const recs = data.recommendations;
  const query = filterQuery(filter);
  // 고른 카드가 목록에서 사라졌으면(필터 변경, 폴링) 1위 카드를 펼친다.
  const open = recs.some((rec) => rec.hub_id === openId) ? openId : (recs[0]?.hub_id ?? null);
  const copyLink = async () => {
    const url = `${window.location.origin}/r/${slug}/result${query}`;
    toast((await copyText(url)) ? MSG_LINK_COPIED : MSG_LINK_COPY_FAILED);
  };

  return (
    <div className="space-y-4">
      <FilterBar filter={filter} appliedRegions={data.regions} appliedTheme={data.theme} onChange={onFilterChange} />
      {recs.length === 0 ? (
        <p className={`${CARD} text-center font-semibold`}>
          {isAllRegions(data.regions) ? MSG_NO_ROUTE : MSG_NO_HUB_IN_REGION}
        </p>
      ) : (
        <ol className="space-y-3">
          {recs.map((rec, index) => (
            <li key={rec.hub_id}>
              <HubCard
                rec={rec}
                rank={index + 1}
                expanded={rec.hub_id === open}
                onToggle={() => setOpenId(rec.hub_id)}
                best={data.best_max_minutes}
                mine={mine}
                href={`/r/${slug}/hubs/${rec.hub_id}${query}`}
              />
            </li>
          ))}
        </ol>
      )}
      <StickyAction>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onAddPeople} className={SECONDARY_BUTTON}>
            사람 추가
          </button>
          <button type="button" onClick={copyLink} className={SECONDARY_BUTTON}>
            결과 링크 복사
          </button>
        </div>
      </StickyAction>
    </div>
  );
}
