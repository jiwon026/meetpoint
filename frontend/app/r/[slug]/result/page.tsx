"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ResultScreen } from "@/components/result/ResultScreen";
import { StepIndicator } from "@/components/ui/StepIndicator";
import { filterFromSearch, filterQuery } from "@/lib/filter";

function ResultPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const filter = filterFromSearch(new URLSearchParams(useSearchParams().toString()));

  return (
    <main>
      <StepIndicator current={3} slug={slug} />
      <ResultScreen
        slug={slug}
        filter={filter}
        // 필터는 보는 사람 화면에서만 바뀐다. 방 설정은 건드리지 않고 URL만 바꾼다.
        onFilterChange={(next) => router.replace(`/r/${slug}/result${filterQuery(next)}`, { scroll: false })}
        onAddPeople={() => router.push(`/r/${slug}?add=1`)}
      />
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ResultPage />
    </Suspense>
  );
}
