import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { ToastProvider } from "@/components/ui/Toast";

function freshClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
}

export function clientWrapper() {
  const client = freshClient();
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <ToastProvider>{children}</ToastProvider>
      </QueryClientProvider>
    );
  };
}

export function renderWithClient(ui: ReactElement) {
  return render(ui, { wrapper: clientWrapper() });
}
