import Link from "next/link";
import type { ReactNode } from "react";
import { articleJsonLd, type Guide } from "@/lib/site";
import { GuideViewed } from "./GuideViewed";

// 가이드 글의 틀. 검색 결과에서 들어온 사람이 읽는 블로그 글 모양이다(2026-11-16 사용자 선택).
export function GuideArticle({ guide, lead, children }: { guide: Guide; lead: ReactNode; children: ReactNode }) {
  return (
    <main>
      <GuideViewed page={guide.id} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd(guide)) }} />
      <article className="space-y-4 break-keep leading-relaxed">
        <header className="space-y-3">
          <p className="text-xs font-semibold text-primary">가이드</p>
          <h1 className="text-balance break-keep text-2xl font-extrabold tracking-tight">{guide.headline}</h1>
          <p className="text-ink-sub">{lead}</p>
        </header>
        {children}
      </article>
    </main>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 pt-4">
      <h2 className="break-keep text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

export function P({ children }: { children: ReactNode }) {
  return <p className="text-[15px] text-ink">{children}</p>;
}

export function Steps({ items }: { items: ReactNode[] }) {
  return (
    <ol className="list-decimal space-y-2 pl-5 text-[15px] marker:font-bold marker:text-primary">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ol>
  );
}

export function GuideLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="font-semibold text-primary underline">
      {children}
    </Link>
  );
}
