import { Ticket } from "lucide-react";
import type { ReactNode } from "react";

// 표 모양 카드. 방 만들기 폼과 방 요약에만 쓴다.
export function TicketCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="rounded-card border border-line bg-card">
      <div className="flex items-center gap-2 rounded-t-card bg-primary px-4 py-2 text-sm font-semibold text-white">
        <Ticket size={16} aria-hidden />
        {label}
      </div>
      <div className="relative border-t border-dashed border-line p-4">
        <span aria-hidden className="absolute -left-2 -top-2 h-4 w-4 rounded-full bg-paper" />
        <span aria-hidden className="absolute -right-2 -top-2 h-4 w-4 rounded-full bg-paper" />
        {children}
      </div>
    </section>
  );
}
