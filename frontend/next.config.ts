import type { NextConfig } from "next";

// 홍보할 때 쓰는 짧은 주소. 유입 경로(UTM)를 붙여 첫 화면으로 보낸다.
// /ig, /tt는 채널 프로필에 걸고 /kakao, /slack은 대화방에, /everytime은 에브리타임 게시글에 붙인다.
// 캠페인 이름을 바꿀 수 있게 브라우저가 기억하지 않는 임시 이동(307)으로 둔다.
const SHORT_LINKS = [
  { source: "/ig", utmSource: "instagram", utmMedium: "social" },
  { source: "/tt", utmSource: "tiktok", utmMedium: "social" },
  { source: "/kakao", utmSource: "kakaotalk", utmMedium: "messenger" },
  { source: "/slack", utmSource: "slack", utmMedium: "messenger" },
  { source: "/everytime", utmSource: "everytime", utmMedium: "community" },
];
const CAMPAIGN = "launch_1008";

const nextConfig: NextConfig = {
  async redirects() {
    return SHORT_LINKS.map(({ source, utmSource, utmMedium }) => ({
      source,
      destination: `/?utm_source=${utmSource}&utm_medium=${utmMedium}&utm_campaign=${CAMPAIGN}`,
      permanent: false,
    }));
  },
};

export default nextConfig;
