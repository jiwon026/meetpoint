import type { Metadata } from "next";
import { HOME_METADATA, websiteJsonLd } from "@/lib/site";
import { HomeFaq } from "@/components/home/HomeFaq";
import { HomeRoute } from "./HomeRoute";

export const metadata: Metadata = HOME_METADATA;

export default function HomePage() {
  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd()) }} />
      <HomeRoute />
      <HomeFaq />
    </main>
  );
}
