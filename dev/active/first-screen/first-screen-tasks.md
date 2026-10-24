# 첫 화면 고치기 체크리스트

- [x] 계획 승인 (2026-10-14)
- [x] 브랜치 `feat/first-screen`, 작업 문서
- [x] 백엔드: 환승역을 한 줄로 묶는 검색, 역을 고르면 같은 역의 모든 노선을 출발 후보로 (테스트 먼저, 전체 341개 통과)
- [x] 화면 시안 세 가지를 보여 주었고 사용자가 A(사람마다 한 줄)를 골랐다
- [x] 프론트 부품: 타입 다시 만들기, `OriginSearch` 노선 배지, `DateStepper`, `ProgressBar`, `useStartMeeting`
- [x] 합친 첫 화면 `HomeScreen`과 `OriginRow`. `CreateRoomForm`, `ThemePicker`, `StepIndicator`는 지웠다
- [x] 통계 이벤트 `origin_drafted`, 문구 정리, 개인정보 안내
- [x] 백엔드 342개, 프론트 단위 166개, 흐름 테스트 1개 통과. 린트와 빌드 통과
- [x] 문서 (`docs/design.md`, `docs/frontend-design.md` 머리말, `CLAUDE.md`)
- [x] 로컬에서 눌러 봄: 환승역 한 줄, 출발지 둘로 추천까지, 뒤로 가면 그 방의 사람 추가 화면
- [x] 코드 검토(심각한 결함 없음)에서 나온 여섯 가지 반영: 나 표시, 중간 실패 뒤 계속 넣기, 넘기는 동안 참여 화면 가리기, 이웃 역 자리, 달력 버튼 이름, 검색 칸 초점
- [x] 아이폰에서 날짜 가운데를 눌러 달력이 뜨는지 확인 (배포 뒤, 2026-10-15 운영에서 확인)
- [x] 사용자 승인 뒤 커밋과 PR, 배포 확인 (PR 22, 1e2389e)
- [ ] 카카오톡과 에브리타임에 뿌리기 (`marketing/copy.md`)
