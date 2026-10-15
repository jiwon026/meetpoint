import { LineBadge } from "./LineBadge";

// 역 이름 옆에 노선 배지를 붙인다. 노선 이름은 화면에 글로 다시 쓰지 않고 읽어 주는 기계에만 남긴다.
export function StationName({ name, lines }: { name: string; lines: readonly string[] }) {
  return (
    <span className="inline-flex min-w-0 flex-wrap items-center gap-1.5">
      <span className="font-semibold">{name}</span>
      {lines.map((line) => (
        <LineBadge key={line} line={line} />
      ))}
      {lines.length > 0 && <span className="sr-only">({lines.join(", ")})</span>}
    </span>
  );
}
