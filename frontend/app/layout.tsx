import type { Metadata, Viewport } from "next";
import Link from "next/link";
import localFont from "next/font/local";
import { AppHeader } from "@/components/ui/AppHeader";
import { SITE_DESCRIPTION, SITE_ORIGIN, SITE_TITLE, SITE_VERIFICATION } from "@/lib/site";
import "./globals.css";
import { Providers } from "./providers";

const pretendard = localFont({
  src: "../node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2",
  variable: "--font-pretendard",
  weight: "45 920",
  display: "swap",
});

// 제목과 설명의 문구와 근거는 lib/site.ts에 있다.
export const metadata: Metadata = {
  // 미리보기 그림(app/opengraph-image.png)의 주소는 절대 주소여야 한다.
  metadataBase: new URL(SITE_ORIGIN),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  verification: {
    google: SITE_VERIFICATION.google,
    other: { "naver-site-verification": SITE_VERIFICATION.naver },
  },
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
            {/* 아래 여백(pb-32)이 하단 고정 바보다 높아서 바에 가려지지 않는다 */}
            <footer className="mt-10 text-center text-xs text-ink-mute">
              <Link href="/privacy" className="underline">
                개인정보 안내
              </Link>
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}
