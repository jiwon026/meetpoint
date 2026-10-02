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
      // 개발 서버는 화면 이동이 첫 컴파일과 겹치면 가끔 404를 보여줘서 흐름이 흔들린다. 빌드한 서버로 돈다.
      command: "npm run build && npm run start -- --port 3100",
      url: "http://localhost:3100",
      timeout: 120_000,
      reuseExistingServer: false,
      env: { NEXT_PUBLIC_API_BASE: "http://localhost:8010", NEXT_PUBLIC_KAKAO_JS_KEY: "" },
    },
  ],
});
