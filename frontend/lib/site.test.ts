import { expect, test } from "vitest";
import { SITE_ORIGIN, robotsRules, sitemapEntries } from "./site";

test("사이트맵에는 첫 화면과 개인정보 안내만 있고 방 주소는 없다", () => {
  const urls = sitemapEntries().map((entry) => entry.url);
  expect(urls).toEqual([SITE_ORIGIN, `${SITE_ORIGIN}/privacy`]);
  expect(urls.some((url) => url.includes("/r/"))).toBe(false);
});

test("robots.txt는 전체를 허용하고 사이트맵 주소를 알려준다", () => {
  expect(robotsRules()).toEqual({ rules: { userAgent: "*", allow: "/" }, sitemap: `${SITE_ORIGIN}/sitemap.xml` });
});
