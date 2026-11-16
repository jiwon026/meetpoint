import type { Metadata } from "next";
import { GuideArticle, GuideLink, P, Section, Steps } from "@/components/guide/GuideArticle";
import { TryButton } from "@/components/guide/TryButton";
import { GUIDES, guideMetadata } from "@/lib/site";

export const metadata: Metadata = guideMetadata(GUIDES.meetingPlace);

// 예시의 분은 모두 로컬 서버에서 실제로 계산한 값이다(dev/active/seo-guides/seo-guides-context.md). 지어내지 않는다.
export default function MeetingPlaceGuidePage() {
  return (
    <GuideArticle
      guide={GUIDES.meetingPlace}
      lead={'"어디서 볼까?"로 시작한 대화가 한참 이어지는 데는 이유가 있어요. 누가 멀리 와야 하는지와 가서 뭘 할지를 한꺼번에 정하려고 해서예요. 둘을 나눠서 순서대로 정하면 훨씬 빨리 끝나요.'}
    >
      <Section title="약속 장소 정하기가 어려운 이유">
        <P>
          장소 하나에 질문 두 개가 섞여 있어요. 하나는 누가 얼마나 멀리 오느냐이고 다른 하나는 거기서 뭘 하느냐예요. 강남처럼
          다 아는 번화가로 정하면 두 번째는 쉽지만 첫 번째에서 한 사람이 손해를 보곤 해요. 거리만 맞추면 이번엔 다른 문제가
          생겨요. 저와 친구들도 그랬어요. 중간에서 만나긴 했는데 할 게 없으면 그게 또 문제였어요.
        </P>
      </Section>

      <Section title="정하는 순서">
        <Steps
          items={[
            "각자 출발하는 곳을 모아요. 집이든 회사든 그날 실제로 출발하는 곳이 기준이에요.",
            <>
              공평한 역을 골라요. 지도 거리보다 지하철로 각자 몇 분 걸리는지를 보고 가장 오래 걸리는 사람이 가장 덜 걸리는 역을
              골라요. 자세한 방법은 <GuideLink href={GUIDES.midpoint.path}>중간지점 찾는법</GuideLink>에 정리했어요.
            </>,
            "그 역 동네에서 할 것을 정해요. 밥, 카페, 술자리, 놀거리 중 모임에 맞는 걸 고르고 마땅치 않으면 다음 후보 역으로 넘어가요.",
          ]}
        />
      </Section>

      <TryButton page="meeting-place" place="middle" />

      <Section title="모임 종류별로 볼 것">
        <P>
          <strong>여러 명 모임.</strong> 사람이 많을수록 한가운데가 애매해져요. 이럴 때 가장 오래 걸리는 사람을 기준으로 삼으면
          쉽게 좁혀져요. 신림, 건대입구, 연신내, 왕십리에서 모이는 네 사람이라면 용산이 나와요. 각자 27분, 29분, 22분, 23분이라
          누구도 30분을 넘지 않아요.
        </P>
        <P>
          <strong>소개팅.</strong> 두 사람의 중간에서 만나면 서로 부담이 덜해요. 홍대입구와 잠실이라면 신당에서 각자 23분, 24분이에요.
          처음 만나는 자리라 조용히 이야기할 카페나 식당이 있는 동네인지도 같이 보면 좋아요.
        </P>
        <P>
          <strong>회식과 동창 모임.</strong> 늦게 끝나기 쉬우니 술집이 많고 늦게까지 여는 동네가 편해요. 사람 수가 많으면 단체석이
          있는 가게가 많은 번화가 쪽을 먼저 보세요.
        </P>
      </Section>

      <Section title="우리지금만나로 한 번에 정하기">
        <P>
          우리지금만나는 이 순서를 한 번에 해 줘요. 각자의 출발역이나 주소를 넣으면 서울에서 모이기 좋은 역 60여 곳 중 공평한
          다섯 곳을 골라 줘요. 맛집, 카페, 술자리, 놀거리 중 모임에 맞는 걸 고르면 딱 맞는 역이 먼저 나와요. 역을 고른 뒤에는 그
          동네의 맛집, 카페, 술집, 놀거리, 행사를 보고 친구에게 링크로 보낼 수 있어요.
        </P>
        <P>
          가입 없이 웹에서 바로 쓸 수 있고 한 방에 20명까지 넣을 수 있어요. 시간은 수도권 지하철 기준이라 버스 길은 반영하지
          않아요.
        </P>
      </Section>

      <TryButton page="meeting-place" place="end" />

      <P>
        지도로 직접 중간을 찾는 방법이 궁금하면 <GuideLink href={GUIDES.midpoint.path}>중간지점 찾는법</GuideLink>도 읽어 보세요.
      </P>
    </GuideArticle>
  );
}
