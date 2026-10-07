import type { MetadataRoute } from "next";
import { robotsRules } from "@/lib/site";

// 규칙과 그 이유는 lib/site.ts에 있다.
export default function robots(): MetadataRoute.Robots {
  return robotsRules();
}
