import type { Metadata, Viewport } from "next";
import Link from "next/link";
import localFont from "next/font/local";
import { AppHeader } from "@/components/ui/AppHeader";
import { SITE_ORIGIN } from "@/lib/site";
import "./globals.css";
import { Providers } from "./providers";

const pretendard = localFont({
  src: "../node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2",
  variable: "--font-pretendard",
  weight: "45 920",
  display: "swap",
});

// 제목과 설명에는 사람들이 검색할 만한 말(약속 장소, 중간 지점)을 넣는다. 없는 기능은 적지 않는다.
export const metadata: Metadata = {
  // 미리보기 그림(app/opengraph-image.png)의 주소는 절대 주소여야 한다.
  metadataBase: new URL(SITE_ORIGIN),
  title: "우리지금만나 | 약속 장소, 중간 지점 찾기",
  description:
    "친구들이 각자 출발지를 넣으면 모두에게 공평한 중간 지점 지하철역을 추천하고 그 동네 맛집, 카페, 술자리, 놀거리를 보여줘요. 가입 없이 링크만 공유하면 돼요. 수도권 지하철 기준.",
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
