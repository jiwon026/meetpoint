import { parseRegions, type Region } from "./regions";
import { parseTheme } from "./themes";

// URL에 적힌 필터. null은 "방의 기본값을 따른다"는 뜻이다.
export type ResultFilter = { regions: readonly Region[] | null; theme: string | null };
export const NO_FILTER: ResultFilter = { regions: null, theme: null };

export function filterFromSearch(search: URLSearchParams): ResultFilter {
  const regions = parseRegions(search.getAll("region"));
  return { regions: regions.length > 0 ? regions : null, theme: parseTheme(search.get("theme")) };
}

export function filterQuery(filter: ResultFilter): string {
  const params = new URLSearchParams();
  for (const region of filter.regions ?? []) params.append("region", region);
  if (filter.theme) params.set("theme", filter.theme);
  const query = params.toString();
  return query ? `?${query}` : "";
}
