import { DEMO_HUB_PATH, DEMO_RESULT_PATH } from "@/lib/demo";
import type { TourStep } from "./Tour";

// 첫 화면과 참여 화면의 온보딩이 같이 쓰는 가운데 단계. 예시 방(lib/demo.ts)의 추천과 둘러보기 화면으로 실제로 넘어가 보여준다.
// target은 각 화면의 data-tour 값이다.
export const DEMO_STEPS: readonly TourStep[] = [
  {
    path: DEMO_RESULT_PATH,
    target: "legs",
    demo: true,
    title: "1위가 가장 공평한 곳이에요",
    body: "예시는 상수, 수유, 삼성에서 만날 때예요. 가장 오래 걸리는 사람의 시간이 짧은 곳부터 줄 세우고, 사람마다 몇 분 걸리는지 보여줘요.",
  },
  {
    path: DEMO_RESULT_PATH,
    target: "themes",
    demo: true,
    title: "모임 성격을 골라요",
    body: "맛집, 카페, 술자리, 놀거리를 고르면 그런 동네를 앞에 보여줘요.",
  },
  {
    path: DEMO_RESULT_PATH,
    target: "explore",
    demo: true,
    title: "그 동네에서 뭐 할지 봐요",
    body: "펼친 동네의 근처 가게와 행사가 나와요. 다른 카드를 펼치면 그 동네로 바뀌어요.",
  },
  {
    path: DEMO_HUB_PATH,
    target: "tabs",
    demo: true,
    title: "맛집부터 행사까지",
    body: "종류를 넘겨 보고, 가게를 누르면 카카오맵에서 별점과 리뷰를 봐요.",
  },
];

// 첫 화면에서 시작하는 온보딩. 끝나면 첫 화면으로 돌아온다.
export const HOME_TOUR: readonly TourStep[] = [
  {
    path: "/",
    target: "origins",
    title: "출발지를 넣어요",
    body: "나와 친구들의 출발역을 넣어요. 친구 출발역을 모르면 내 것만 넣고 링크를 보내 각자 넣게 해도 돼요.",
  },
  {
    path: "/",
    target: "start",
    title: "공평한 역이 나와요",
    body: "누르면 추천 화면으로 넘어가요. 예시로 먼저 보여드릴게요.",
  },
  ...DEMO_STEPS,
  {
    path: DEMO_RESULT_PATH,
    target: "result-actions",
    demo: true,
    title: "친구 출발지는 친구가 넣어요",
    body: "공유하기로 결과를 보내면 친구도 같은 추천을 보고 자기 출발지를 넣어요. 빠진 사람은 사람 추가로 넣어요.",
  },
];

// 링크로 들어온 참여 화면에서 시작하는 온보딩. 끝나면 그 방의 참여 화면으로 돌아온다.
export function joinTour(joinPath: string): TourStep[] {
  return [
    {
      path: joinPath,
      target: "join-form",
      title: "내 출발지를 넣어요",
      body: "닉네임과 출발역을 넣고 등록해요. 가입은 없어요.",
    },
    {
      path: joinPath,
      target: "show-result",
      title: "공평한 역이 나와요",
      body: "두 명부터 추천이 나와요. 예시로 먼저 보여드릴게요.",
    },
    ...DEMO_STEPS,
    {
      path: joinPath,
      target: "invite",
      title: "친구 출발지는 친구가 넣어요",
      body: "초대 링크를 보내면 각자 넣고 다 같이 추천을 봐요.",
    },
  ];
}
