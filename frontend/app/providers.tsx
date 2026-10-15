"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { ToastProvider } from "@/components/ui/Toast";
import { TourProvider } from "@/components/ui/TourProvider";
import { initAnalytics } from "@/lib/analytics";
import { shouldRetry } from "@/lib/api/hooks";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: shouldRetry }, mutations: { retry: false } } }),
  );
  // 통계는 브라우저에서 한 번만 시작한다. 키가 없으면 아무 일도 하지 않는다 (lib/analytics.ts).
  useEffect(() => {
    initAnalytics();
  }, []);
  return (
    <QueryClientProvider client={client}>
      <ToastProvider>
        {/* 온보딩은 화면 사이를 오가므로 화면보다 위에 둔다 */}
        <TourProvider>{children}</TourProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
