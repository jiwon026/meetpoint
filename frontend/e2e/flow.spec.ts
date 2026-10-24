import { expect, test, type Page } from "@playwright/test";

const FOOD = {
  kind: "food",
  items: [
    {
      id: "1",
      name: "테스트 국밥집",
      category: "국밥",
      address: "서울 어딘가 1",
      distance_m: 210,
      url: "https://place.map.kakao.com/1",
      lat: 37.5,
      lng: 127.0,
    },
  ],
  error: null,
};

// 첫 화면에서 펼쳐진 줄에 역을 넣는다. 고르면 다음 빈 줄이 펼쳐진다.
async function pickOrigin(page: Page, station: string) {
  await page.getByLabel("출발지 검색").fill(station);
  // 역 이름이 정확히 같은 결과만 (수원을 찾을 때 수원시청이 걸리지 않게)
  await page.getByRole("button", { name: new RegExp(`^${station}\\s`) }).first().click();
}

test("첫 화면에서 출발지를 넣고 주변 둘러보기까지", async ({ page }) => {
  // 카카오와 행사 API는 부르지 않는다. 콘텐츠 응답만 고정한다.
  await page.route(/\/hubs\/\d+\/content/, (route) => route.fulfill({ json: FOOD }));

  // 모임 이름과 날짜는 기본값 그대로 둔다. 출발지 둘이면 추천을 볼 수 있다.
  await page.goto("/");
  // 처음 온 브라우저여도 사용법은 저절로 뜨지 않는다.
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "출발지를 두 곳 넣어주세요" })).toBeDisabled();
  await pickOrigin(page, "홍대입구");
  await pickOrigin(page, "수원");
  await page.getByRole("button", { name: "추천 보기 (2명)" }).click();

  await expect(page).toHaveURL(/\/r\/[A-Za-z0-9]{6,8}\/result$/);
  const slug = new URL(page.url()).pathname.split("/")[2] ?? "";
  const cards = page.getByTestId("hub-card");
  await expect(cards).toHaveCount(5);

  // 뒤로 가면 빈 첫 화면이 아니라 이 방의 사람 추가 화면이고, 넣은 두 사람이 보인다. 앞으로 가면 결과로 돌아온다.
  await page.goBack();
  await expect(page).toHaveURL(/\/r\/[A-Za-z0-9]{6,8}\?add=1$/);
  // 참여 화면에서도 사용법은 저절로 뜨지 않는다.
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "출발지 등록" })).toBeVisible();
  await expect(page.getByText("친구 1", { exact: true })).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(/\/result/);
  await expect(cards).toHaveCount(5);

  // 등록한 사람이 있는 브라우저가 add 없이 참여 주소로 들어오면 결과로 간다.
  await page.goto(`/r/${slug}`);
  await expect(page).toHaveURL(/\/result/);
  await expect(cards).toHaveCount(5);

  // 방은 서울로 만들어지고 지역은 고르지 않는다. 수원에서 오는 사람이 있어도 서울 거점만 나온다.
  const summaries = await page.getByTestId("hub-summary").allTextContents();
  expect(summaries).toHaveLength(5);
  expect(summaries.every((text) => text.startsWith("서울"))).toBe(true);
  await expect(page.getByRole("button", { name: "경기", exact: true })).toHaveCount(0);

  // 테마 필터는 남아 있고 주소에 적힌다.
  await page.getByRole("button", { name: "카페", exact: true }).click();
  await expect(page).toHaveURL(/theme=cafe/);
  await expect(cards).toHaveCount(5);

  await page.getByRole("link", { name: "이 동네 둘러보기" }).click();
  await expect(page).toHaveURL(/\/hubs\/\d+\?theme=cafe/);
  await expect(page.getByText("테스트 국밥집")).toBeVisible();
  await expect(page.getByText("도보 약 4분")).toBeVisible();
});

test("사용법 보기를 누르면 예시 방의 추천과 둘러보기 화면을 오가며 사용법을 보고 첫 화면으로 돌아온다", async ({ page }) => {
  await page.goto("/");
  const dialog = page.getByRole("dialog");
  await page.getByRole("button", { name: "사용법 보기" }).click();
  await expect(dialog).toContainText("1. 출발지를 넣어요");
  const expected: [RegExp, string][] = [
    [/\/$/, "2. 공평한 역이 나와요"],
    [/\/r\/demo\/result$/, "3. 1위가 가장 공평한 곳이에요"],
    [/\/r\/demo\/result$/, "4. 모임 성격을 골라요"],
    [/\/r\/demo\/result$/, "5. 그 동네에서 뭐 할지 봐요"],
    [/\/r\/demo\/hubs\/\d+$/, "6. 맛집부터 행사까지"],
    [/\/r\/demo\/result$/, "7. 친구 출발지는 친구가 넣어요"],
  ];
  for (const [url, title] of expected) {
    await page.getByRole("button", { name: "다음" }).click();
    await expect(page).toHaveURL(url);
    await expect(dialog).toContainText(title);
  }
  // 예시 화면은 서버를 부르지 않고 그린다. 추천 카드가 보여야 한다.
  await expect(page.getByTestId("hub-card").first()).toBeVisible();
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(dialog).toHaveCount(0);
  // 다시 들어와도 저절로 뜨지 않는다.
  await page.reload();
  await expect(page.getByRole("button", { name: "출발지를 두 곳 넣어주세요" })).toBeVisible();
  await expect(dialog).toHaveCount(0);
});
