// 링크 미리보기 그림(app/opengraph-image.png)을 scripts/og-image.html에서 다시 찍는다.
// 그림이나 문구를 바꾸려면 og-image.html을 고치고 npm run gen:og.
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const here = path.dirname(fileURLToPath(import.meta.url));
const source = path.join(here, "og-image.html");
const output = path.join(here, "..", "app", "opengraph-image.png");

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.goto(pathToFileURL(source).href);
  await page.evaluate(() => document.fonts.ready);
  const fontLoaded = await page.evaluate(() => document.fonts.check('800 40px "Pretendard"'));
  if (!fontLoaded) throw new Error("Pretendard를 불러오지 못했습니다. npm install을 먼저 실행하세요.");
  await page.locator("#a").screenshot({ path: output });
  console.log(`wrote ${output}`);
} finally {
  await browser.close();
}
