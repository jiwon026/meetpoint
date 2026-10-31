import type { Metadata, MetadataRoute } from "next";

// 운영 주소. 미리보기 그림, 사이트맵, robots.txt에는 절대 주소가 필요하다. Vercel이 빌드 때 운영 도메인을 넣어준다.
export const SITE_ORIGIN = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

// 검색 도구에 사이트 주인임을 알리는 확인 코드. 페이지에 그대로 실리는 공개 값이라 비밀이 아니다.
// 구글 서치 콘솔과 네이버 서치어드바이저에서 "HTML 태그" 방식으로 받은 값이다.
export const SITE_VERIFICATION = {
  google: "hgSWUTE03fDf84EanFvN1U-zBEPnJpKiN5TRYi0nd5k",
  naver: "2d0546a72aad965f0845fb4dfc068a7ebe0f84a7",
} as const;

// 검색에 나와도 되는 페이지만 적는다. 방 주소(/r/...)는 아는 사람만 보는 링크라 넣지 않는다.
export function sitemapEntries(): MetadataRoute.Sitemap {
  return [
    { url: SITE_ORIGIN, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_ORIGIN}/privacy`, changeFrequency: "yearly", priority: 0.3 },
  ];
}

// /r/ 를 막지 않는다. robots.txt로 막힌 크롤러는 방 페이지의 noindex 메타 태그를 읽지 못하고,
// 링크 미리보기 수집기는 robots.txt를 따르면 방 제목 미리보기를 잃을 수 있다.
// 검색에서 빼는 일은 방 페이지의 noindex, nofollow(lib/roomMeta.ts)가 맡는다.
export function robotsRules(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/" }, sitemap: `${SITE_ORIGIN}/sitemap.xml` };
}

// 대표 주소(canonical). /?utm_source=instagram 처럼 붙여 들어온 주소를 검색 엔진이 한 페이지로 모으게 한다.
// 상대 주소는 layout.tsx의 metadataBase(SITE_ORIGIN)를 앞에 붙여 절대 주소가 된다.
export const HOME_METADATA: Metadata = { alternates: { canonical: "/" } };

export const PRIVACY_METADATA: Metadata = {
  title: "개인정보 안내 | 우리지금만나",
  description:
    "우리지금만나가 저장하고 보내는 값을 사실대로 적었어요. 입력한 주소 원문은 저장하지 않고 위치는 약 100m 단위로만 남겨요.",
  alternates: { canonical: "/privacy" },
};

// 검색 결과에 도메인 대신 서비스 이름이 뜨게 하는 구조화 데이터. 구글 안내대로 첫 화면에만 넣는다.
export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "우리지금만나",
    url: `${SITE_ORIGIN}/`,
  };
}
