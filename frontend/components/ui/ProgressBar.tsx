import Link from "next/link";

const STEPS = ["출발지", "추천", "둘러보기"] as const;

// fill은 지금 단계를 얼마나 채웠는지(0~1). 첫 화면에서 출발지를 넣을 때마다 막대가 조금씩 찬다.
type Props = { current: 1 | 2 | 3; fill?: number; slug?: string; query?: string };

// 바로 앞 단계의 주소. 브라우저 기록이 아니라 단계로 정해서, 링크로 바로 들어온 사람도 같은 곳으로 간다.
function previousHref(current: number, slug: string | undefined, query: string): string | null {
  if (!slug) return null;
  // add=1은 "이미 등록한 브라우저는 추천으로 보낸다"는 규칙을 건너뛰게 한다.
  if (current === 2) return `/r/${slug}?add=1`;
  if (current === 3) return `/r/${slug}/result${query}`;
  return null;
}

export function ProgressBar({ current, fill = 1, slug, query = "" }: Props) {
  const within = Math.min(1, Math.max(0, fill));
  const percent = Math.round(((current - 1 + within) / STEPS.length) * 100);
  const back = previousHref(current, slug, query);
  return (
    <nav aria-label="진행 단계" className="relative mb-4 space-y-1.5">
      {/* 뒤로 버튼은 바로 위 헤더 줄의 오른쪽에 띄운다. 진행 바의 폭을 줄이지 않게. */}
      {back && (
        <Link
          href={back}
          aria-label={`뒤로, ${STEPS[current - 2]}`}
          className="absolute -top-10 right-0 rounded-full border border-line bg-card px-3 py-1 text-sm font-semibold text-ink-sub active:bg-track"
        >
          ‹ 뒤로
        </Link>
      )}
      <div
        role="progressbar"
        aria-label="진행 정도"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-1.5 overflow-hidden rounded-full bg-track"
      >
        <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${percent}%` }} />
      </div>
      <ol className="flex justify-between text-xs font-semibold">
        {STEPS.map((label, index) => {
          const step = index + 1;
          const tone = step === current ? "text-primary" : step < current ? "text-ink-sub" : "text-ink-mute";
          return (
            <li key={label} aria-current={step === current ? "step" : undefined} className={tone}>
              {label}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
