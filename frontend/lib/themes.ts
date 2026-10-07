export type ContentKind = "food" | "cafe" | "drink" | "play" | "event";
export type ThemeId = "food" | "cafe" | "drink" | "play";
export const THEME_OFF = "any";

type ThemeInfo = { id: ThemeId; label: string; hint: string; tab: ContentKind };

// tab은 주변 화면에서 먼저 여는 탭.
export const THEMES: readonly ThemeInfo[] = [
  { id: "food", label: "맛집", hint: "밥이 중요한 모임", tab: "food" },
  { id: "cafe", label: "카페", hint: "수다 떨기 좋은 곳", tab: "cafe" },
  { id: "drink", label: "술자리", hint: "한잔하기 좋은 곳", tab: "drink" },
  { id: "play", label: "놀거리", hint: "방탈출, 보드게임", tab: "play" },
];

export const CONTENT_TABS: readonly { kind: ContentKind; label: string }[] = [
  { kind: "food", label: "맛집" },
  { kind: "cafe", label: "카페" },
  { kind: "drink", label: "술자리" },
  { kind: "play", label: "놀거리" },
  { kind: "event", label: "행사" },
];

// 모르는 값은 버리고 중복을 없앤 뒤 순서를 맛집, 카페, 술자리, 놀거리로 맞춘다.
export function pickThemes(values: readonly string[] | null | undefined): ThemeId[] {
  return THEMES.map((theme) => theme.id).filter((id) => values?.includes(id));
}

export function themeLabels(values: readonly string[] | null | undefined): string[] {
  return THEMES.filter((theme) => values?.includes(theme.id)).map((theme) => theme.label);
}

// 주소의 theme 값들. any가 있으면 "테마 없이", 아는 값이 하나도 없으면 null(방의 기본값을 따름).
export function parseThemes(values: readonly string[]): ThemeId[] | typeof THEME_OFF | null {
  if (values.includes(THEME_OFF)) return THEME_OFF;
  const chosen = pickThemes(values);
  return chosen.length > 0 ? chosen : null;
}

// 테마를 여러 개 골랐으면 맛집, 카페, 술자리, 놀거리 순서에서 가장 앞선 것의 탭을 연다.
export function firstTab(themes: readonly string[] | null | undefined): ContentKind {
  return THEMES.find((theme) => themes?.includes(theme.id))?.tab ?? "food";
}
