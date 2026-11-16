import { expect, test } from "vitest";
import {
  GUIDES,
  HOME_METADATA,
  PRIVACY_METADATA,
  SITE_DESCRIPTION,
  SITE_ORIGIN,
  SITE_TITLE,
  articleJsonLd,
  guideMetadata,
  robotsRules,
  sitemapEntries,
  websiteJsonLd,
} from "./site";

test("사이트맵에는 첫 화면, 가이드 두 편, 개인정보 안내가 있고 방 주소는 없다", () => {
  const urls = sitemapEntries().map((entry) => entry.url);
  expect(urls).toEqual([
    SITE_ORIGIN,
    `${SITE_ORIGIN}/guide/midpoint`,
    `${SITE_ORIGIN}/guide/meeting-place`,
    `${SITE_ORIGIN}/privacy`,
  ]);
  expect(urls.some((url) => url.includes("/r/"))).toBe(false);
});

test("robots.txt는 전체를 허용하고 사이트맵 주소를 알려준다", () => {
  expect(robotsRules()).toEqual({ rules: { userAgent: "*", allow: "/" }, sitemap: `${SITE_ORIGIN}/sitemap.xml` });
});

test("첫 화면과 개인정보 안내는 각자 자기 주소를 대표 주소로 둔다", () => {
  expect(HOME_METADATA.alternates?.canonical).toBe("/");
  expect(PRIVACY_METADATA.alternates?.canonical).toBe("/privacy");
});

test("개인정보 안내는 첫 화면과 다른 제목과 설명을 쓴다", () => {
  expect(PRIVACY_METADATA.title).toBe("개인정보 안내 | 우리지금만나");
  expect(PRIVACY_METADATA.description).toContain("주소 원문은 저장하지 않고");
});

test("사이트 이름 구조화 데이터는 서비스 이름과 첫 화면 주소를 담는다", () => {
  expect(websiteJsonLd()).toEqual({
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "우리지금만나",
    url: `${SITE_ORIGIN}/`,
  });
});

test("사이트 제목은 많이 찾는 검색어를 앞에, 서비스 이름을 끝에 둔다", () => {
  expect(SITE_TITLE.startsWith("약속장소 중간지점 찾기")).toBe(true);
  expect(SITE_TITLE.endsWith("| 우리지금만나")).toBe(true);
  expect(SITE_DESCRIPTION).toContain("지하철");
  expect(SITE_DESCRIPTION).toContain("가장 오래 걸리는 사람");
});

test("가이드는 각자 자기 주소를 대표 주소로 두고 검색어를 제목 앞에 둔다", () => {
  expect(guideMetadata(GUIDES.midpoint).alternates?.canonical).toBe("/guide/midpoint");
  expect(guideMetadata(GUIDES.meetingPlace).alternates?.canonical).toBe("/guide/meeting-place");
  expect(String(guideMetadata(GUIDES.midpoint).title).startsWith("중간지점 찾는법")).toBe(true);
  expect(String(guideMetadata(GUIDES.meetingPlace).title).startsWith("약속 장소 정하기")).toBe(true);
  for (const guide of Object.values(GUIDES)) {
    expect(String(guideMetadata(guide).title).endsWith("| 우리지금만나")).toBe(true);
    expect(guideMetadata(guide).description).toBeTruthy();
  }
});

test("가이드 글 구조화 데이터는 제목과 절대 주소를 담는다", () => {
  expect(articleJsonLd(GUIDES.midpoint)).toMatchObject({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: GUIDES.midpoint.headline,
    url: `${SITE_ORIGIN}/guide/midpoint`,
    inLanguage: "ko",
  });
});
