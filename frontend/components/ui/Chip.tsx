import type { ReactNode } from "react";

type Props = { selected: boolean; onClick: () => void; children: ReactNode };

export function Chip({ selected, onClick, children }: Props) {
  const tone = selected ? "border-primary bg-primary text-white" : "border-line bg-card text-ink-sub";
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${tone}`}
    >
      {children}
    </button>
  );
}
