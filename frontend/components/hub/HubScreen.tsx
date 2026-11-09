"use client";

import { useCallback, useEffect, useRef } from "react";
import { Share2 } from "lucide-react";
import { Loading } from "@/components/ui/Loading";
import { StickyAction } from "@/components/ui/StickyAction";
import { CARD, PRIMARY_BUTTON } from "@/components/ui/styles";
import { useToast } from "@/components/ui/Toast";
import { track } from "@/lib/analytics";
import { useResult } from "@/lib/api/hooks";
import { filterQuery, type ResultFilter } from "@/lib/filter";
import { MSG_LINK_COPIED, MSG_LINK_COPY_FAILED } from "@/lib/messages";
import { copyText, shareLink } from "@/lib/share";
import { firstTab } from "@/lib/themes";
import { ContentTabs } from "./ContentTabs";
import { HubHeader } from "./HubHeader";

type Props = { slug: string; hubId: number; filter: ResultFilter; onGone: () => void };

export function HubScreen({ slug, hubId, filter, onGone }: Props) {
  const toast = useToast();
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

  // 거점을 처음 보여줄 때 한 번만 통계를 남긴다. 순위는 지금 결과 목록 안의 위치(1부터)다.
  const viewed = useRef(false);
  useEffect(() => {
    if (viewed.current || !rec) return;
    viewed.current = true;
    const index = result.data?.recommendations.findIndex((r) => r.hub_id === rec.hub_id) ?? -1;
    track("hub_viewed", { hub_name: rec.name, region: rec.region, rank: index + 1 });
  }, [rec, result.data]);

  // 이미 불러온 거점이 있으면 재조회 실패로 화면을 지우지 않는다.
  if (result.error && !rec) {
    return (
      <p role="alert" className={`${CARD} text-center font-semibold`}>
        {result.error.message}
      </p>
    );
  }
  if (!rec) return <Loading />;

  // 동네를 골랐으면 친구에게 알리는 게 다음 일이다. 휴대폰은 공유창으로, 공유창이 없으면 링크를 복사한다.
  // 받은 친구는 같은 둘러보기 화면을 연다.
  const shareHub = async () => {
    const url = `${window.location.origin}/r/${slug}/hubs/${hubId}${filterQuery(filter)}`;
    const outcome = await shareLink({ title: `${rec.name}에서 만나요`, url });
    if (outcome === "shared") track("link_shared", { place: "hub" });
    if (outcome !== "unsupported") return;
    const copied = await copyText(url);
    toast(copied ? MSG_LINK_COPIED : MSG_LINK_COPY_FAILED);
    if (copied) track("link_copied", { place: "hub" });
  };

  return (
    <div className="space-y-4">
      <HubHeader rec={rec} />
      <ContentTabs
        slug={slug}
        hubId={hubId}
        initial={firstTab(result.data?.themes)}
        center={{ lat: rec.lat, lng: rec.lng }}
        onGone={gone}
      />
      <StickyAction>
        <button type="button" onClick={shareHub} className={PRIMARY_BUTTON}>
          <Share2 size={18} aria-hidden />
          친구에게 {rec.name} 보내기
        </button>
      </StickyAction>
    </div>
  );
}
