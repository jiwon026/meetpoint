"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ShareButtons } from "@/components/join/ShareButtons";
import { KakaoMap } from "@/components/map/KakaoMap";
import { legOrigins } from "@/lib/origins";
import { Loading } from "@/components/ui/Loading";
import { StickyAction } from "@/components/ui/StickyAction";
import { useToast } from "@/components/ui/Toast";
import { CARD, PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/ui/styles";
import { track } from "@/lib/analytics";
import { useResult } from "@/lib/api/hooks";
import { SERVICE_NAME } from "@/lib/constants";
import { filterQuery, type ResultFilter } from "@/lib/filter";
import {
  MSG_LINK_COPIED,
  MSG_LINK_COPY_FAILED,
  MSG_NEED_TWO,
  MSG_NO_HUB_IN_REGION,
  MSG_NO_ROUTE,
} from "@/lib/messages";
import { readMine } from "@/lib/myParticipants";
import { isAllRegions, parseRegions } from "@/lib/regions";
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

  // 준비된 결과를 처음 보여줄 때 한 번만 통계를 남긴다. 폴링이나 필터 변경으로 다시 와도 반복하지 않는다.
  const viewed = useRef(false);
  const data = result.data;
  useEffect(() => {
    if (viewed.current || data?.status !== "ready") return;
    viewed.current = true;
    track("result_viewed", {
      participant_count: data.recommendations[0]?.legs.length ?? 0,
      regions: parseRegions(data.regions).join(","),
      theme: data.theme ?? "none",
      recommendation_count: data.recommendations.length,
    });
  }, [data]);

  if (!data) {
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
    return <Loading />;
  }

  if (data.status === "waiting") {
    return (
      <section className={`${CARD} space-y-4 text-center`}>
        <p className="font-bold">{MSG_NEED_TWO}</p>
        <ShareButtons slug={slug} title={SERVICE_NAME} place="result" />
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
    const copied = await copyText(url);
    toast(copied ? MSG_LINK_COPIED : MSG_LINK_COPY_FAILED);
    if (copied) track("link_copied", { place: "result" });
  };

  return (
    <div className="space-y-4">
      <FilterBar filter={filter} appliedRegions={data.regions} appliedTheme={data.theme} onChange={onFilterChange} />
      {recs.length === 0 ? (
        <p className={`${CARD} text-center font-semibold`}>
          {isAllRegions(data.regions) ? MSG_NO_ROUTE : MSG_NO_HUB_IN_REGION}
        </p>
      ) : (
        <>
          <KakaoMap
            pins={recs.map((rec, index) => ({
              id: String(rec.hub_id),
              lat: rec.lat,
              lng: rec.lng,
              // 1위 핀에는 이름을 붙여 한눈에 찾게 한다.
              label: index === 0 ? `1위 ${rec.name}` : String(index + 1),
            }))}
            activeId={open === null ? null : String(open)}
            origins={legOrigins(recs.find((rec) => rec.hub_id === open)?.legs ?? [])}
          />
          <ol className="space-y-3">
            {recs.map((rec, index) => (
              <li key={rec.hub_id}>
                <HubCard
                  rec={rec}
                  rank={index + 1}
                  expanded={rec.hub_id === open}
                  onToggle={() => {
                    // 이미 펼쳐진 카드를 다시 누르는 것은 새로 여는 것이 아니다.
                    if (rec.hub_id !== open) track("hub_card_opened", { rank: index + 1 });
                    setOpenId(rec.hub_id);
                  }}
                  best={data.best_max_minutes}
                  mine={mine}
                  href={`/r/${slug}/hubs/${rec.hub_id}${query}`}
                />
              </li>
            ))}
          </ol>
        </>
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
