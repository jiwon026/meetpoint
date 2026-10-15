"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { HubScreen } from "@/components/hub/HubScreen";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { useToast } from "@/components/ui/Toast";
import { filterFromSearch, filterQuery } from "@/lib/filter";
import { MSG_HUB_GONE } from "@/lib/messages";

function HubPage() {
  const { slug, hubId } = useParams<{ slug: string; hubId: string }>();
  const router = useRouter();
  const toast = useToast();
  const filter = filterFromSearch(new URLSearchParams(useSearchParams().toString()));
  const query = filterQuery(filter);

  const onGone = () => {
    toast(MSG_HUB_GONE);
    router.replace(`/r/${slug}/result${query}`);
  };

  return (
    <main>
      <ProgressBar current={3} slug={slug} query={query} />
      {/* 숫자가 아닌 hubId는 NaN이 되어 추천 목록에서 못 찾고 onGone으로 간다 */}
      <HubScreen slug={slug} hubId={Number(hubId)} filter={filter} onGone={onGone} />
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <HubPage />
    </Suspense>
  );
}
