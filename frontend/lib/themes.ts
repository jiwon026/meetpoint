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
  { kind: "drink", label: "술집" },
  { kind: "play", label: "놀거리" },
  { kind: "event", label: "행사" },
];

export function isThemeId(value: string | null | undefined): value is ThemeId {
  return THEMES.some((theme) => theme.id === value);
}

export function themeLabel(value: string | null | undefined): string | null {
  return THEMES.find((theme) => theme.id === value)?.label ?? null;
}

export function parseTheme(value: string | null): ThemeId | typeof THEME_OFF | null {
  if (value === THEME_OFF) return THEME_OFF;
  return isThemeId(value) ? value : null;
}

export function firstTab(theme: string | null | undefined): ContentKind {
  return THEMES.find((t) => t.id === theme)?.tab ?? "food";
}
