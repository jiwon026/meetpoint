import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { AppHeader } from "@/components/ui/AppHeader";
import "./globals.css";
import { Providers } from "./providers";

const pretendard = localFont({
  src: "../node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2",
  variable: "--font-pretendard",
  weight: "45 920",
  display: "swap",
});

export const metadata: Metadata = {
  title: "우리지금만나",
  description: "각자 출발지를 넣으면 가장 공평한 만남 장소를 찾아줘요",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={pretendard.variable}>
      <body className="font-sans antialiased">
        <Providers>
          <div className="mx-auto min-h-dvh max-w-[480px] px-4 pb-32 pt-4">
            <AppHeader />
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
