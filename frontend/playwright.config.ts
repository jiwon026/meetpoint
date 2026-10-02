import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  use: { baseURL: "http://localhost:3100", ...devices["Pixel 7"] },
  webServer: [
    {
      command: "node e2e/start-backend.mjs",
      url: "http://localhost:8010/health",
      timeout: 120_000,
      reuseExistingServer: false,
    },
    {
      // next dev에서는 흐름이 약 40% 확률로 Next의 404 화면에 닿았다(원인 미상, 경로 미리 열기는 효과 없음).
      // 빌드한 서버는 안정적이라 이것을 쓴다. 그래서 이 테스트는 개발 모드 동작을 덮지 않는다.
      // 미검증 단서: 같은 기기에서 fs.rmSync가 한글 경로에서 Node를 죽였으니 경로를 먼저 의심해 볼 것.
      command: "npm run build && npm run start -- --port 3100",
      url: "http://localhost:3100",
      timeout: 180_000,
      reuseExistingServer: false,
      env: { NEXT_PUBLIC_API_BASE: "http://localhost:8010", NEXT_PUBLIC_KAKAO_JS_KEY: "" },
    },
  ],
});
