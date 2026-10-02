import type { LegOut } from "@/lib/api/types";
import { aboutMinutes, average } from "@/lib/format";

export function FairnessStats({ legs, spread }: { legs: readonly LegOut[]; spread: number }) {
  const minutes = legs.map((leg) => leg.minutes);
  const stats = [
    { label: "가장 오래", value: aboutMinutes(Math.max(...minutes)), strong: true },
    { label: "평균", value: aboutMinutes(average(minutes)), strong: false },
    { label: "차이", value: `${spread}분`, strong: false },
  ];
  return (
    <dl className="grid grid-cols-3 gap-2">
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-lg bg-track p-2.5">
          <dt className="text-xs text-ink-mute">{stat.label}</dt>
          <dd className={`font-bold ${stat.strong ? "text-accent" : ""}`}>{stat.value}</dd>
        </div>
      ))}
    </dl>
  );
}
