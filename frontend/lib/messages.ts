// 프론트에서만 쓰는 문구. 백엔드가 주는 문구(detail)는 그대로 보여주므로 여기서 다시 만들지 않는다.
// 예외로 MSG_ROOM_FULL은 백엔드 문구와 같은 글이다. 참여 화면이 요청을 보내기 전에 먼저 보여주려고 둔다.
// 바꾸면 docs/design.md 8절도 함께 고친다.
export const MSG_NETWORK = "연결이 불안정해요. 잠시 후 다시 시도해주세요.";
export const MSG_INVALID_INPUT = "입력을 다시 확인해주세요";
export const MSG_TITLE_REQUIRED = "모임 이름을 적어주세요";
export const MSG_DATE_REQUIRED = "오늘 이후 날짜를 골라주세요";
export const MSG_DATE_TOO_FAR = "약속 날짜는 1년 안으로 골라주세요";
export const MSG_REGION_REQUIRED = "만날 지역을 하나 이상 골라주세요";
export const MSG_NICKNAME_REQUIRED = "닉네임을 적어주세요";
export const MSG_ORIGIN_REQUIRED = "출발지를 골라주세요";
export const MSG_PRIVACY = "원래 주소는 저장하지 않아요. 약 100m 단위로 뭉갠 위치만 약속 7일 뒤까지 보관해요.";
export const MSG_AUTO_DELETE = "약속 7일 뒤 자동 삭제";
export const MSG_NEED_TWO = "친구를 초대하세요. 두 명부터 추천이 나와요.";
export const MSG_EMPTY_ROSTER = "아직 아무도 없어요. 첫 번째로 출발지를 넣어보세요.";
export const MSG_NO_SEARCH_RESULT = "찾지 못했어요. 다른 이름으로 검색해보세요.";
export const MSG_ROOM_FULL = "참여 인원이 가득 찼어요 (최대 20명)";
export const MSG_BUS = "버스 15분 포함";
export const MSG_NO_HUB_IN_REGION = "이 지역엔 추천할 곳이 없어요. 지역을 넓혀보세요.";
export const MSG_NO_ROUTE = "경로를 계산하지 못했어요. 방을 새로 만들어 다시 시도해주세요.";
export const MSG_LEGS_MISSING = "이동시간을 불러오지 못했어요";
export const MSG_THEME_MATCH = "테마에 맞아요";
export const MSG_HUB_GONE = "추천이 바뀌었어요";
export const MSG_NOTHING_NEARBY = "근처에서 찾지 못했어요";
export const MSG_LINK_COPIED = "링크를 복사했어요";
export const MSG_LINK_COPY_FAILED = "복사하지 못했어요. 주소창의 링크를 직접 복사해주세요.";
export const MSG_ROOM_CREATED = "방을 만들었어요. 링크를 복사했어요";
export const MSG_ROOM_CREATED_NO_COPY = "방을 만들었어요";
export const MSG_LOADING = "불러오는 중이에요";
export const MSG_WAKING = "서버를 깨우는 중이에요. 최대 1분쯤 걸려요.";

export function msgConfirmRemove(nickname: string): string {
  return `${nickname}님을 계산에서 뺄까요? 다시 넣을 수 있어요`;
}

export function msgSlowerThanBest(minutes: number): string {
  return `가장 빠른 곳보다 ${minutes}분 더`;
}
export const MSG_SORT_NOTE = "추천순은 카카오맵이 매긴 순서예요. 별점은 가게를 눌러 카카오맵에서 확인하세요.";
