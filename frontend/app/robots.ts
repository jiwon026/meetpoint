import type { MetadataRoute } from "next";

// /r/ 를 막지 않는다. robots.txt로 막힌 크롤러는 방 페이지의 noindex 메타 태그를 읽지 못하고,
// 링크 미리보기 수집기는 robots.txt를 따르면 방 제목 미리보기를 잃을 수 있다.
// 검색에서 빼는 일은 방 페이지의 noindex, nofollow(lib/roomMeta.ts)가 맡는다.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/" } };
}
