import { expect, test, type Page } from "@playwright/test";
import { addDaysIso, todayIso } from "../lib/format";

// 서버가 지난 날짜와 1년 넘는 날짜를 거절하므로 실행 시점 기준으로 잡는다.
const MEET_DATE = addDaysIso(todayIso(), 7);

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
  await page.getByLabel("약속 날짜").fill(MEET_DATE);
  for (const region of ["서울", "경기", "인천"]) {
    await page.getByRole("button", { name: region, exact: true }).click();
  }
  await page.getByRole("button", { name: "방 만들고 링크 받기" }).click();

  await expect(page).toHaveURL(/\/r\/[A-Za-z0-9]{6,8}$/);
  const slug = new URL(page.url()).pathname.split("/").pop() ?? "";
  await expect(page.getByRole("heading", { name: "흐름 테스트 모임" })).toBeVisible();

  await addPerson(page, "홍대사람", "홍대입구");
  await addPerson(page, "수원사람", "수원");
  await page.getByRole("button", { name: "추천 보기 (2명)" }).click();

  await expect(page).toHaveURL(/\/result/);
  const cards = page.getByTestId("hub-card");
  await expect(cards).toHaveCount(5);

  // 뒤로 가면 사람 추가 화면에 머물고(결과로 되튕기지 않음), 앞으로 가면 결과로 돌아온다.
  await page.goBack();
  await expect(page).toHaveURL(/\/r\/[A-Za-z0-9]{6,8}\?add=1$/);
  await expect(page.getByRole("button", { name: "출발지 등록" })).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(/\/result/);
  await expect(cards).toHaveCount(5);

  // 등록한 사람이 있는 브라우저가 add 없이 참여 주소로 들어오면 결과로 간다.
  await page.goto(`/r/${slug}`);
  await expect(page).toHaveURL(/\/result/);
  await expect(cards).toHaveCount(5);

  // 필터 검증이 의미가 있으려면 거르기 전 목록에 서울이 아닌 곳이 있어야 한다.
  const before = await page.getByTestId("hub-summary").allTextContents();
  expect(before).toHaveLength(5);
  expect(before.some((text) => !text.startsWith("서울"))).toBe(true);

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
