"use client";

import { useCallback, useEffect, useRef } from "react";
import { CARD } from "@/components/ui/styles";
import { useResult } from "@/lib/api/hooks";
import type { ResultFilter } from "@/lib/filter";
import { MSG_LOADING } from "@/lib/messages";
import { firstTab } from "@/lib/themes";
import { ContentTabs } from "./ContentTabs";
import { HubHeader } from "./HubHeader";

type Props = { slug: string; hubId: number; filter: ResultFilter; onGone: () => void };

export function HubScreen({ slug, hubId, filter, onGone }: Props) {
  // 거점 단건 API는 없다. 추천 결과에서 찾는다. 이 화면에서는 폴링하지 않는다.
  const result = useResult(slug, filter, { poll: false });
  const rec = result.data?.recommendations.find((r) => r.hub_id === hubId) ?? null;
  const missing = result.isSuccess && rec === null;

  // 데이터 재적재로 거점 id가 바뀌면 여기로 온다. 안내와 이동은 한 번만 한다.
  const fired = useRef(false);
  const gone = useCallback(() => {
    if (fired.current) return;
    fired.current = true;
    onGone();
  }, [onGone]);

  useEffect(() => {
    if (missing) gone();
  }, [missing, gone]);

  // 이미 불러온 거점이 있으면 재조회 실패로 화면을 지우지 않는다.
  if (result.error && !rec) {
    return (
      <p role="alert" className={`${CARD} text-center font-semibold`}>
        {result.error.message}
      </p>
    );
  }
  if (!rec) return <p className="py-10 text-center text-ink-mute">{MSG_LOADING}</p>;

  return (
    <div className="space-y-4">
      <HubHeader rec={rec} />
      <ContentTabs
        slug={slug}
        hubId={hubId}
        initial={firstTab(result.data?.theme)}
        center={{ lat: rec.lat, lng: rec.lng }}
        onGone={gone}
      />
    </div>
  );
}
