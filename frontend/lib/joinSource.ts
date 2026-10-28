// 참여 화면(/r/<슬러그>)에 어떻게 왔는지. 통계(join_viewed)에만 쓴다.
// link: 남이 보낸 초대 링크를 열었다. add_people: 추천 화면의 사람 추가. home: 첫 화면에서 친구 부르기를 골랐거나
// 일부를 넣지 못했다. tour: 사용법 보기가 끝나고 돌아왔다. back: 추천 화면에서 뒤로 왔다(add=1만 있다).
export type JoinSource = "link" | "add_people" | "home" | "tour" | "back";

const FROM: Record<string, JoinSource> = { add: "add_people", home: "home", tour: "tour" };

export function joinSource(params: URLSearchParams): JoinSource {
  if (params.get("add") !== "1") return "link";
  return FROM[params.get("from") ?? ""] ?? "back";
}
