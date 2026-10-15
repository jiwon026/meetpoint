export const REGIONS = ["서울", "경기", "인천"] as const;
export type Region = (typeof REGIONS)[number];

export function parseRegions(values: readonly string[]): Region[] {
  return REGIONS.filter((region) => values.includes(region));
}

