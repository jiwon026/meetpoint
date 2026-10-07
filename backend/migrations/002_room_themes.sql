-- 방의 테마를 여러 개 고를 수 있게 목록을 담는 열을 더한다.
-- 기존 theme 열은 그대로 둔다. 이 열을 더하기 전에 만든 방은 themes가 null이고 theme 값을 읽는다.
-- 새 백엔드를 배포하기 전에 실행한다(새 코드는 이 열을 읽는다). 여러 번 실행해도 된다.
alter table public.rooms add column if not exists themes json;
