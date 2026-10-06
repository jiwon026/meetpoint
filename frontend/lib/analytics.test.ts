import { afterEach, beforeEach, expect, test, vi } from "vitest";

const sdk = vi.hoisted(() => ({ init: vi.fn(), track: vi.fn() }));
vi.mock("@amplitude/analytics-browser", () => sdk);

// vitest.setup.ts가 @/lib/analytics를 가짜로 바꿔 두므로 진짜 모듈을 직접 불러온다.
// 모듈 안의 init 상태를 테스트마다 새로 시작하려고 매번 모듈을 다시 불러온다.
async function load() {
  vi.resetModules();
  return vi.importActual<typeof import("./analytics")>("./analytics");
}

beforeEach(() => {
  sdk.init.mockReset();
  sdk.track.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

test("키가 없으면 초기화하지 않고 아무것도 보내지 않는다", async () => {
  vi.stubEnv("NEXT_PUBLIC_AMPLITUDE_API_KEY", "");
  const { initAnalytics, track } = await load();
  initAnalytics();
  track("link_copied", { place: "join" });
  expect(sdk.init).not.toHaveBeenCalled();
  expect(sdk.track).not.toHaveBeenCalled();
});

test("초기화하기 전에는 track이 아무것도 보내지 않는다", async () => {
  vi.stubEnv("NEXT_PUBLIC_AMPLITUDE_API_KEY", "test-key");
  const { track } = await load();
  track("link_copied", { place: "join" });
  expect(sdk.track).not.toHaveBeenCalled();
});

test("키가 있으면 여러 번 불러도 한 번만 초기화한다", async () => {
  vi.stubEnv("NEXT_PUBLIC_AMPLITUDE_API_KEY", "test-key");
  const { initAnalytics } = await load();
  initAnalytics();
  initAnalytics();
  initAnalytics();
  expect(sdk.init).toHaveBeenCalledOnce();
});

test("자동 수집은 끄고 세션과 유입 경로만 켠다. IP는 저장하지 않고 사용자 id도 정하지 않는다", async () => {
  vi.stubEnv("NEXT_PUBLIC_AMPLITUDE_API_KEY", "test-key");
  const { initAnalytics } = await load();
  initAnalytics();
  const [apiKey, userId, options] = sdk.init.mock.calls[0];
  expect(apiKey).toBe("test-key");
  expect(userId).toBeUndefined();
  expect(options).toEqual({
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
});

test("초기화한 뒤에는 이벤트 이름과 속성을 그대로 넘긴다", async () => {
  vi.stubEnv("NEXT_PUBLIC_AMPLITUDE_API_KEY", "test-key");
  const { initAnalytics, track } = await load();
  initAnalytics();
  track("place_link_clicked", { kind: "cafe", sort: "distance", position: 3 });
  expect(sdk.track).toHaveBeenCalledExactlyOnceWith("place_link_clicked", {
    kind: "cafe",
    sort: "distance",
    position: 3,
  });
});

test("SDK가 예외를 던져도 화면으로 새지 않는다", async () => {
  vi.stubEnv("NEXT_PUBLIC_AMPLITUDE_API_KEY", "test-key");
  const { initAnalytics, track } = await load();
  initAnalytics();
  sdk.track.mockImplementation(() => {
    throw new Error("sdk down");
  });
  expect(() => track("hub_card_opened", { rank: 2 })).not.toThrow();
});

test("초기화가 실패하면 예외를 삼키고 이후 track은 보내지 않는다", async () => {
  vi.stubEnv("NEXT_PUBLIC_AMPLITUDE_API_KEY", "test-key");
  sdk.init.mockImplementation(() => {
    throw new Error("blocked");
  });
  const { initAnalytics, track } = await load();
  expect(() => initAnalytics()).not.toThrow();
  track("hub_card_opened", { rank: 1 });
  expect(sdk.track).not.toHaveBeenCalled();
});
