import type { ReactNode } from "react";

export function StickyAction({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card/95 backdrop-blur">
      <div className="mx-auto max-w-[480px] px-4 py-3">{children}</div>
    </div>
  );
}
