import type { ContentKind } from "./themes";

export type PlaceSort = "recommended" | "distance";

// 추천순은 카카오맵이 매긴 순서다. 별점이나 리뷰 수가 아니라서 인기순이라고 부르지 않는다.
export const PLACE_SORTS: readonly { id: PlaceSort; label: string }[] = [
  { id: "recommended", label: "추천순" },
  { id: "distance", label: "가까운 순" },
];

export const DEFAULT_PLACE_SORT: PlaceSort = "recommended";

// 놀거리는 검색어 여러 개를 합친 목록이고 행사는 날짜 기준이라 정렬을 고르지 않는다.
export function isSortable(kind: ContentKind): boolean {
  return kind === "food" || kind === "cafe";
}
