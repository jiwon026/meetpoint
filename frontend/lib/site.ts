import type { MetadataRoute } from "next";

// 운영 주소. 미리보기 그림, 사이트맵, robots.txt에는 절대 주소가 필요하다. Vercel이 빌드 때 운영 도메인을 넣어준다.
export const SITE_ORIGIN = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

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
