import type { ReactNode } from "react";

// 빨간 도장. "1위"와 "테마에 맞아요"에만 쓴다.
export function Stamp({ children }: { children: ReactNode }) {
  return (
    <span className="inline-block -rotate-3 rounded bg-accent px-2 py-0.5 text-xs font-bold text-white">
      {children}
    </span>
  );
}
