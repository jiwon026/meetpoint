import Link from "next/link";

const STEPS = ["방 만들기", "참여", "추천", "둘러보기"] as const;

type Props = { current: 1 | 2 | 3 | 4; slug?: string; query?: string };

function hrefFor(step: number, slug: string | undefined, query: string): string | null {
  if (!slug) return null;
  if (step === 1) return "/";
  // add=1은 "이미 등록한 브라우저는 추천으로 보낸다"는 규칙을 건너뛰게 한다.
  if (step === 2) return `/r/${slug}?add=1`;
  if (step === 3) return `/r/${slug}/result${query}`;
  return null;
}

export function StepIndicator({ current, slug, query = "" }: Props) {
  return (
    <ol aria-label="진행 단계" className="mb-4 flex items-center gap-1.5">
      {STEPS.map((label, index) => {
        const step = index + 1;
        const href = step < current ? hrefFor(step, slug, query) : null;
        const tone =
          step === current
            ? "bg-primary text-white"
            : step < current
              ? "bg-primary-tint text-primary"
              : "bg-track text-ink-mute";
        const body = (
          <span className={`block rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>
            {step} {label}
          </span>
        );
        return (
          <li key={label} aria-current={step === current ? "step" : undefined}>
            {href ? <Link href={href}>{body}</Link> : body}
          </li>
        );
      })}
    </ol>
  );
}
