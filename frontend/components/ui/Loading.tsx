"use client";

import { useEffect, useState } from "react";
import { SLOW_MS } from "@/lib/constants";
import { MSG_LOADING, MSG_WAKING } from "@/lib/messages";

// 이 컴포넌트가 화면에 붙은 뒤 SLOW_MS가 지났는지. 기다리는 동안에만 렌더하므로 붙은 시점이 곧 기다리기 시작한 시점이다.
function useSlow(): boolean {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), SLOW_MS);
    return () => clearTimeout(timer);
  }, []);
  return slow;
}

export function Loading({ className = "py-10 text-center text-ink-mute" }: { className?: string }) {
  const slow = useSlow();
  return (
    <p role="status" className={className}>
      {slow ? MSG_WAKING : MSG_LOADING}
    </p>
  );
}

// 버튼처럼 이미 진행 표시가 있는 곳에 쓴다. 오래 걸릴 때만 이유를 덧붙인다.
export function SlowNote() {
  const slow = useSlow();
  if (!slow) return null;
  return (
    <p role="status" className="text-center text-sm text-ink-mute">
      {MSG_WAKING}
    </p>
  );
}
