import { lineStyle, shortLine } from "@/lib/lines";

export function LineBadge({ line }: { line: string }) {
  const { background, color } = lineStyle(line);
  return (
    <span
      title={line}
      style={{ backgroundColor: background, color }}
      className="inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold"
    >
      {shortLine(line)}
    </span>
  );
}
