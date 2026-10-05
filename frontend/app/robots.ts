import type { MetadataRoute } from "next";

// 방 링크(/r/...)는 크롤링하지 않게 한다. 첫 화면은 열어둔다.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/", disallow: "/r/" } };
}
