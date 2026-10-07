import type { Metadata } from "next";
import { CARD } from "@/components/ui/styles";

export const metadata: Metadata = { title: "개인정보 안내 | 우리지금만나" };

const CONTACT_EMAIL = "kwonjiwon6886@gmail.com";

// 어떤 값을 저장하고 보내는지 사실대로 적는다. 저장하는 값이 바뀌면 이 글도 같이 고친다.
export default function PrivacyPage() {
  return (
    <main className="space-y-3">
      <h1 className="text-2xl font-extrabold tracking-tight">개인정보 안내</h1>
      <Item title="무엇을 저장하나">
        닉네임, 출발지에서 가장 가까운 역, 약 100m 단위로 뭉갠 위치를 저장해요. 입력한 주소 원문은 저장하지 않아요.
      </Item>
      <Item title="언제 지우나">약속 날짜 7일 뒤에 방과 참가자 정보를 자동으로 지워요.</Item>
      <Item title="누가 볼 수 있나">
        방 링크를 아는 사람은 그 방의 닉네임과 가까운 역 이름을 볼 수 있어요. 방 페이지는 검색 엔진에 나오지 않게 해
        두었어요.
      </Item>
      <Item title="이용 통계">
        서비스를 고치려고 익명 이용 통계를 모아요. 어떤 화면을 봤는지, 어떤 버튼을 눌렀는지, 고른 지역과 테마 같은
        값이에요. 닉네임, 출발역, 주소, 검색어, 방 링크는 통계에 넣지 않아요. 통계는 미국 회사 Amplitude의 서버에
        저장되고, 브라우저마다 임의로 만든 번호로만 구분해요. IP 주소는 저장하지 않게 설정했어요. 다른 사이트의 링크를
        눌러 처음 들어왔다면 그 사이트의 주소도 함께 기록돼요.
      </Item>
      <Item title="외부 서비스">
        지도와 장소 정보는 카카오, 행사 정보는 서울시 열린데이터광장과 공연예술통합전산망(KOPIS)에서 가져와요. 주소
        검색어는 장소를 찾으려고 카카오에 전달돼요.
      </Item>
      <Item title="문의">
        문의와 삭제 요청은{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-primary underline">
          {CONTACT_EMAIL}
        </a>{" "}
        으로 보내 주세요.
      </Item>
    </main>
  );
}

function Item({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={`${CARD} space-y-1.5`}>
      <h2 className="font-bold">{title}</h2>
      <p className="text-sm leading-relaxed text-ink-sub">{children}</p>
    </section>
  );
}
