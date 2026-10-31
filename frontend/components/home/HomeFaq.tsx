import { CARD } from "@/components/ui/styles";

// 검색으로 들어온 사람이 묻는 말을 그대로 질문으로 쓰고, 답은 결론 문장부터 굵게 쓴다.
// 사실이 바뀌면(정원, 지역, 계산 방식) 같이 고친다. 근거: backend/app/rooms/service.py, docs/design.md
const FAQ: { question: string; answer: string; detail: string }[] = [
  {
    question: "약속장소 중간지점은 어떻게 정하나요?",
    answer: "가장 오래 걸리는 사람의 이동 시간이 가장 짧은 역을 골라요.",
    detail: "지도 위 한가운데가 아니라 지하철로 각자 몇 분 걸리는지를 계산해서, 누구 한 명만 멀리 오지 않게 해요.",
  },
  {
    question: "지하철 중간역은 어떻게 찾나요?",
    answer: "출발역이나 주소를 넣으면 지하철 시간으로 계산해요.",
    detail: "주소를 넣으면 가까운 역에서 출발하는 것으로 보고, 갈아타는 시간도 넣어서 계산해요.",
  },
  {
    question: "앱을 설치해야 하나요?",
    answer: "아니요, 웹에서 바로 쓰고 가입도 없어요.",
    detail: "링크를 보내면 친구가 자기 출발지를 직접 넣을 수 있어요.",
  },
  {
    question: "몇 명까지 되나요?",
    answer: "한 약속에 20명까지예요.",
    detail: "두 명부터 추천을 볼 수 있어요.",
  },
  {
    question: "어느 지역까지 되나요?",
    answer: "출발지는 수도권 지하철이 닿는 곳이면 돼요.",
    detail: "만날 역은 서울부터 보여 주고, 추천 화면에서 경기와 인천도 켤 수 있어요.",
  },
];

export function HomeFaq() {
  return (
    <section aria-labelledby="home-faq" className="mt-10 space-y-2">
      <h2 id="home-faq" className="text-lg font-bold">
        자주 묻는 질문
      </h2>
      {FAQ.map(({ question, answer, detail }) => (
        <details key={question} className={`${CARD} group`}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-semibold">
            <h3>{question}</h3>
            <span aria-hidden className="text-ink-mute transition-transform group-open:rotate-180">
              ▾
            </span>
          </summary>
          <p className="mt-2 text-sm leading-relaxed text-ink-sub">
            <strong className="text-ink">{answer}</strong> {detail}
          </p>
        </details>
      ))}
    </section>
  );
}
