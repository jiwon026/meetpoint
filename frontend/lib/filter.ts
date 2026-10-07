import { parseRegions, type Region } from "./regions";
import { parseThemes, THEME_OFF, type ThemeId } from "./themes";

// URL에 적힌 필터. null은 "방의 기본값을 따른다"는 뜻이다. themes의 "any"는 테마 없이 보겠다는 뜻이다.
export type ResultFilter = {
  regions: readonly Region[] | null;
  themes: readonly ThemeId[] | typeof THEME_OFF | null;
};
export const NO_FILTER: ResultFilter = { regions: null, themes: null };

export function filterFromSearch(search: URLSearchParams): ResultFilter {
  const regions = parseRegions(search.getAll("region"));
  return { regions: regions.length > 0 ? regions : null, themes: parseThemes(search.getAll("theme")) };
}

export function filterQuery(filter: ResultFilter): string {
  const params = new URLSearchParams();
  for (const region of filter.regions ?? []) params.append("region", region);
  const themes = filter.themes === THEME_OFF ? [THEME_OFF] : (filter.themes ?? []);
  for (const theme of themes) params.append("theme", theme);
  const query = params.toString();
  return query ? `?${query}` : "";
}
