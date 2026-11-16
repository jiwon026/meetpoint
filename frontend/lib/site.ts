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
    ...Object.values(GUIDES).map((guide) => ({
      url: `${SITE_ORIGIN}${guide.path}`,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    { url: `${SITE_ORIGIN}/privacy`, changeFrequency: "yearly", priority: 0.3 },
  ];
}

// /r/ 를 막지 않는다. robots.txt로 막힌 크롤러는 방 페이지의 noindex 메타 태그를 읽지 못하고,
// 링크 미리보기 수집기는 robots.txt를 따르면 방 제목 미리보기를 잃을 수 있다.
// 검색에서 빼는 일은 방 페이지의 noindex, nofollow(lib/roomMeta.ts)가 맡는다.
export function robotsRules(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/" }, sitemap: `${SITE_ORIGIN}/sitemap.xml` };
}

// 첫 화면의 검색 제목과 설명. 서치어드바이저에서 노출이 가장 많은 "약속장소 중간지점"을 맨 앞에,
// 클릭률이 높은 "지하철"을 그 뒤에 둔다(2026-10-31, dev/active/seo/seo-context.md). 없는 기능은 적지 않는다.
export const SITE_TITLE = "약속장소 중간지점 찾기 - 지하철로 모두 공평한 역 추천 | 우리지금만나";
export const SITE_DESCRIPTION =
  "출발역만 넣으면 지하철로 각자 몇 분 걸리는지 계산해서, 가장 오래 걸리는 사람도 덜 걸리는 중간역을 골라 줘요. 그 동네 맛집, 카페, 술집, 행사까지 한 번에. 가입 없이 링크로 친구와 함께, 수도권 지하철 기준.";

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

// 방법을 찾는 검색어를 받는 글(2026-11-16, dev/active/seo-guides). title은 검색 결과 제목, headline은 글의 h1이다.
// 검색어 배정은 dev/active/seo/keywords.csv의 P1 줄을 따른다.
export type Guide = { path: string; title: string; headline: string; description: string; published: string };

export const GUIDES = {
  midpoint: {
    path: "/guide/midpoint",
    title: "중간지점 찾는법 - 카카오맵, 네이버지도와 지하철 시간 기준으로 약속장소 정하기 | 우리지금만나",
    headline: "중간지점 찾는법: 지도 한가운데보다 지하철 시간으로",
    description:
      "카카오맵, 네이버지도로 약속장소 중간지점을 찾는 법과 그 한계를 정리했어요. 지하철로 각자 몇 분 걸리는지로 공평한 역을 고르는 법도 예시로 보여 드려요.",
    published: "2026-11-16",
  },
  meetingPlace: {
    path: "/guide/meeting-place",
    title: "약속 장소 정하기 - 모임, 소개팅 장소를 싸우지 않고 정하는 법 | 우리지금만나",
    headline: "약속 장소 정하기: 모임과 소개팅 장소를 덜 싸우고 정하는 순서",
    description:
      "모임 장소, 소개팅 장소를 정할 때 누가 멀리 오는지와 가서 뭘 할지를 순서대로 정리했어요. 지하철 시간 기준으로 공평한 역을 고르는 예시도 있어요.",
    published: "2026-11-16",
  },
} as const satisfies Record<string, Guide>;

export function guideMetadata(guide: Guide): Metadata {
  return { title: guide.title, description: guide.description, alternates: { canonical: guide.path } };
}

// 검색 엔진이 글로 알아보게 하는 구조화 데이터. 글 페이지마다 하나씩 넣는다.
export function articleJsonLd(guide: Guide) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.headline,
    description: guide.description,
    url: `${SITE_ORIGIN}${guide.path}`,
    inLanguage: "ko",
    datePublished: guide.published,
    author: { "@type": "Organization", name: "우리지금만나", url: `${SITE_ORIGIN}/` },
  };
}
