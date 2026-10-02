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

async function addPerson(page: Page, nickname: string, station: string) {
  await page.getByLabel("닉네임").fill(nickname);
  await page.getByLabel("출발지 검색").fill(station);
  // 역 이름이 정확히 같은 결과만 (수원을 찾을 때 수원시청이 걸리지 않게)
  await page.getByRole("button", { name: new RegExp(`^${station}\\s`) }).first().click();
  await page.getByRole("button", { name: "출발지 등록" }).click();
  await expect(page.getByText(nickname, { exact: true })).toBeVisible();
}

test("방 만들기부터 주변 둘러보기까지", async ({ page }) => {
  // 카카오와 행사 API는 부르지 않는다. 콘텐츠 응답만 고정한다.
  await page.route(/\/hubs\/\d+\/content/, (route) => route.fulfill({ json: FOOD }));

  await page.goto("/");
  await page.getByLabel("모임 이름").fill("흐름 테스트 모임");
  await page.getByLabel("약속 날짜").fill("2030-01-05");
  await page.getByRole("button", { name: "방 만들고 링크 받기" }).click();

  await expect(page).toHaveURL(/\/r\/[A-Za-z0-9]{6,8}$/);
  await expect(page.getByRole("heading", { name: "흐름 테스트 모임" })).toBeVisible();

  await addPerson(page, "홍대사람", "홍대입구");
  await addPerson(page, "수원사람", "수원");
  await page.getByRole("button", { name: "추천 보기 (2명)" }).click();

  await expect(page).toHaveURL(/\/result/);
  const cards = page.getByTestId("hub-card");
  await expect(cards).toHaveCount(5);

  // 지역을 서울만 남긴다. 상위 5곳을 자르기 전에 걸러지므로 여전히 5곳이 나와야 한다.
  await page.getByRole("button", { name: "경기", exact: true }).click();
  await expect(page.getByRole("button", { name: "경기", exact: true })).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "인천", exact: true }).click();
  await expect(page).toHaveURL(/region=/);
  await expect(page.getByRole("button", { name: "인천", exact: true })).toHaveAttribute("aria-pressed", "false");
  await expect(async () => {
    const summaries = await page.getByTestId("hub-summary").allTextContents();
    expect(summaries).toHaveLength(5);
    expect(summaries.every((text) => text.startsWith("서울"))).toBe(true);
  }).toPass();

  await page.getByRole("link", { name: "이 동네 둘러보기" }).click();
  await expect(page).toHaveURL(/\/hubs\/\d+\?region=/);
  await expect(page.getByText("테스트 국밥집")).toBeVisible();
  await expect(page.getByText("도보 약 4분")).toBeVisible();
});
