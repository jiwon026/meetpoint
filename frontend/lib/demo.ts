// 온보딩이 보여주는 예시 방. 서버를 부르지 않고 미리 담아 둔 응답으로 추천과 둘러보기 화면을 그린다.
// 응답은 로컬 서버에서 상수(6호선), 수유(4호선), 삼성(2호선)으로 실제 방을 만들어 받은 것이다(2026-10-15).
// 숫자를 손으로 고치지 않는다. 다시 만들 때는 같은 방식으로 받아 lib/demo-data.json을 바꾸고 DEMO_HUB_ID를 맞춘다.
import { addDaysIso, todayIso } from "./format";

// 실제 방 주소는 6자 또는 8자라 겹치지 않는다 (backend/app/rooms/slug.py).
export const DEMO_SLUG = "demo";
// 예시 추천의 1위 거점(신당). 둘러보기 화면의 주소에 쓴다.
export const DEMO_HUB_ID = 10;

export const DEMO_RESULT_PATH = `/r/${DEMO_SLUG}/result`;
export const DEMO_HUB_PATH = `/r/${DEMO_SLUG}/hubs/${DEMO_HUB_ID}`;

const PREFIX = `/rooms/${DEMO_SLUG}`;

export function isDemoPath(path: string): boolean {
  return path === PREFIX || path.startsWith(`${PREFIX}/`) || path.startsWith(`${PREFIX}?`);
}

type DemoData = {
  room: { meet_date: string; expires_at: string } & Record<string, unknown>;
  result: Record<string, unknown>;
  content: Record<string, unknown>;
};

// 예시 응답을 돌려준다. 읽기만 되고, 맞는 응답이 없으면 null.
// 데이터는 온보딩을 볼 때만 내려받도록 따로 불러온다.
export async function demoResponse(path: string): Promise<unknown | null> {
  const data = (await import("./demo-data.json")).default as unknown as DemoData;
  const [pathname, query = ""] = path.split("?");
  if (pathname === PREFIX) {
    // 날짜가 지나 보이지 않게 약속은 늘 일주일 뒤로 둔다.
    const meet = addDaysIso(todayIso(), 7);
    return { ...data.room, meet_date: meet, expires_at: `${addDaysIso(meet, 7)}T00:00:00` };
  }
  if (pathname === `${PREFIX}/result`) return data.result;
  const content = pathname.match(/^\/rooms\/demo\/hubs\/\d+\/content$/);
  if (content) {
    const params = new URLSearchParams(query);
    const kind = params.get("kind") ?? "food";
    const sort = params.get("sort");
    const key = sort ? `kind=${kind}&sort=${sort}` : `kind=${kind}`;
    return data.content[key] ?? { kind, items: [], error: null };
  }
  return null;
}
