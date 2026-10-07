# 테마 중복 선택 컨텍스트

Last Updated: 2026-10-07

## 핵심 파일

- 백엔드: `app/models.py`(Room), `app/schemas.py`(RoomCreate, RoomOut, ResultOut), `app/rooms/service.py`(`room_themes`, `_applied_themes`, `compute_result`), `app/rooms/router.py`(결과의 `theme` 쿼리), `migrations/002_room_themes.sql`
- 프론트: `lib/themes.ts`, `lib/filter.ts`, `components/room/ThemePicker.tsx`, `components/room/CreateRoomForm.tsx`, `components/result/FilterBar.tsx`, `components/join/RoomSummary.tsx`, `components/hub/HubScreen.tsx`, `components/result/ResultScreen.tsx`

## 결정

- 하나라도 맞으면 테마에 맞는 거점으로 본다 (`rank_with_preference`의 `preferred_hub_ids`를 넓힐 뿐 순위 규칙은 그대로).
- 테마 목록은 저장할 때 중복을 없애고 맛집, 카페, 술자리, 놀거리 순서로 맞춘다 (지역과 같은 방식).
- DB는 열 추가만 한다. 기존 열을 고치거나 지우지 않는다.
- 응답에 예전 `theme`을 남겨 두는 이유: 백엔드가 먼저 배포되는 동안 예전 화면이 그 값을 읽는다.

## 다음 계획에 넘길 것

- 예전 `theme` 필드와 `rooms.theme` 열 정리 (plan의 "나중에").
