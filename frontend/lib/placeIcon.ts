// 가게 카드에 붙이는 분류 아이콘. 카카오가 주는 분류 이름(예: "해물,생선", "디저트카페", "오뎅바")에서 낱말을 찾아 고른다.
// 사진 대신이다. 카카오 장소 API는 사진을 주지 않고, 이미지 검색은 엉뚱한 사진이 많아 쓰지 않기로 했다(2026-10-15 시험).
import type { ContentKind } from "./themes";

export type PlaceIconName =
  | "food"
  | "soup"
  | "meat"
  | "chicken"
  | "seafood"
  | "snack"
  | "pizza"
  | "sandwich"
  | "coffee"
  | "dessert"
  | "bakery"
  | "icecream"
  | "beer"
  | "wine"
  | "cocktail"
  | "karaoke"
  | "escape"
  | "board"
  | "game"
  | "movie"
  | "art"
  | "comic"
  | "fun";

type Rule = readonly [readonly string[], PlaceIconName];

// 위에서부터 처음 맞는 규칙을 쓴다. 좁은 낱말을 넓은 낱말보다 먼저 둔다.
const RULES: Record<Exclude<ContentKind, "event">, { rules: readonly Rule[]; fallback: PlaceIconName }> = {
  food: {
    rules: [
      [["떡볶이", "분식"], "snack"],
      [["닭", "치킨"], "chicken"],
      [["해물", "생선", "회", "초밥", "스시", "일식", "조개", "해산물", "장어"], "seafood"],
      [["갈비", "고기", "곱창", "막창", "삼겹", "구이", "족발", "보쌈", "육류", "양꼬치"], "meat"],
      [["국밥", "순대", "탕", "찌개", "곰탕", "해장", "국수", "냉면", "라면", "우동", "면"], "soup"],
      [["피자"], "pizza"],
      [["버거", "샌드위치", "토스트"], "sandwich"],
    ],
    fallback: "food",
  },
  cafe: {
    rules: [
      [["아이스크림", "빙수", "젤라또"], "icecream"],
      [["베이커리", "빵", "제과", "도넛", "베이글"], "bakery"],
      [["디저트", "케이크"], "dessert"],
    ],
    fallback: "coffee",
  },
  drink: {
    rules: [
      [["와인"], "wine"],
      [["포차", "포장마차", "오뎅", "이자카야", "주점", "호프", "맥주", "펍", "술집"], "beer"],
      [["칵테일", "위스키", "바"], "cocktail"],
    ],
    fallback: "beer",
  },
  play: {
    rules: [
      [["노래"], "karaoke"],
      [["방탈출"], "escape"],
      [["보드"], "board"],
      [["만화"], "comic"],
      [["게임", "PC방", "오락"], "game"],
      [["영화", "극장"], "movie"],
      [["공방", "전시", "미술", "갤러리"], "art"],
      [["술", "주점", "칵테일"], "beer"],
    ],
    fallback: "fun",
  },
};

export function placeIcon(kind: Exclude<ContentKind, "event">, category: string): PlaceIconName {
  const { rules, fallback } = RULES[kind];
  return rules.find(([words]) => words.some((word) => category.includes(word)))?.[1] ?? fallback;
}
