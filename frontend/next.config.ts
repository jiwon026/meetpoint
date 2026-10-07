import type { NextConfig } from "next";

// 홍보 채널 프로필에 거는 짧은 주소. 유입 경로(UTM)를 붙여 첫 화면으로 보낸다.
// 캠페인 이름을 바꿀 수 있게 브라우저가 기억하지 않는 임시 이동(307)으로 둔다.
const SHORT_LINKS = [
  { source: "/ig", utmSource: "instagram" },
  { source: "/tt", utmSource: "tiktok" },
];
const CAMPAIGN = "launch_1008";

const nextConfig: NextConfig = {
  async redirects() {
    return SHORT_LINKS.map(({ source, utmSource }) => ({
      source,
      destination: `/?utm_source=${utmSource}&utm_medium=social&utm_campaign=${CAMPAIGN}`,
      permanent: false,
    }));
  },
};

export default nextConfig;
