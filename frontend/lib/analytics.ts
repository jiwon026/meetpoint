// 익명 이용 통계. 이벤트 목록과 속성은 이 파일이 유일한 원본이다.
// 닉네임, 참가자의 출발역, 주소, 검색어, 좌표, 방 슬러그는 어떤 이벤트에도 넣지 않는다.
// 거점 이름(강남, 판교 등)은 공개된 장소 이름이라 넣어도 된다.
// Amplitude SDK는 이 파일에서만 불러온다.

import * as amplitude from "@amplitude/analytics-browser";

export type AnalyticsEvents = {
  room_created: { regions: string; region_count: number; theme: string; days_until_meet: number };
  join_viewed: { participant_count: number };
  participant_added: { method: "station" | "address"; participant_count: number };
  link_copied: { place: "join" | "result" };
  result_viewed: { participant_count: number; regions: string; theme: string; recommendation_count: number };
  result_filter_changed: { kind: "region" | "theme"; value: string };
  hub_card_opened: { rank: number };
  directions_clicked: { rank: number };
  hub_viewed: { hub_name: string; region: string; rank: number };
  content_tab_selected: { kind: "food" | "cafe" | "play" | "event" };
  place_sort_changed: { kind: "food" | "cafe"; sort: "recommended" | "distance" };
  place_link_clicked: { kind: "food" | "cafe" | "play"; sort: "recommended" | "distance"; position: number };
};

let started = false;

// 키가 없으면(로컬 개발, 단위 테스트, e2e 빌드) 아무것도 초기화하지 않고 아무것도 보내지 않는다.
// 방 주소(/r/<슬러그>)는 비공개 링크라서 URL이 새 나가는 기능은 모두 끈다:
// 페이지뷰와 클릭, 폼, 다운로드 자동 수집, 이벤트에 붙는 페이지 주소(pageUrlEnrichment),
// 그리고 Amplitude 콘솔에서 원격으로 자동 수집을 켜는 설정(remoteConfig)까지.
// 유입 경로는 사용자 속성으로만 남기고, 같은 사이트 안의 이전 주소(슬러그가 들어 있을 수 있다)는 버린다.
export function initAnalytics(): void {
  if (started) return;
  const apiKey = process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY;
  if (!apiKey) return;
  try {
    amplitude.init(apiKey, undefined, {
      autocapture: {
        pageViews: false,
        elementInteractions: false,
        formInteractions: false,
        fileDownloads: false,
        frustrationInteractions: false,
        networkTracking: false,
        webVitals: false,
        performanceTracking: false,
        pageUrlEnrichment: false,
        sessions: true,
        attribution: { trackingMethod: "userProperty", excludeInternalReferrers: true },
      },
      trackingOptions: { ipAddress: false },
      remoteConfig: { fetchRemoteConfig: false },
      enableDiagnostics: false,
    });
    started = true;
  } catch (error) {
    // 통계가 안 되는 것이 서비스를 막으면 안 된다.
    console.warn("analytics init failed", error);
  }
}

// 초기화 전에는 아무 일도 하지 않는다. SDK 오류는 화면으로 올리지 않는다.
export function track<E extends keyof AnalyticsEvents>(event: E, props: AnalyticsEvents[E]): void {
  if (!started) return;
  try {
    amplitude.track(event, props);
  } catch (error) {
    console.warn("analytics track failed", error);
  }
}
