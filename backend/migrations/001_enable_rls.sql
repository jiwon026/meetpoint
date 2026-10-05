-- Supabase는 public 스키마의 표를 Data API로 내보낸다. 우리는 그 API를 쓰지 않는다.
-- 모든 표에 RLS를 켜고 정책을 만들지 않으면 anon, authenticated 역할은 아무 행도 읽거나 쓰지 못한다.
-- 백엔드는 postgres 역할로 접속하므로 영향을 받지 않는다.
-- scripts.init_db로 표를 만든 직후 한 번 실행한다. 여러 번 실행해도 된다.
alter table public.station_groups enable row level security;
alter table public.stations enable row level security;
alter table public.hubs enable row level security;
alter table public.station_times enable row level security;
alter table public.rooms enable row level security;
alter table public.participants enable row level security;
alter table public.content_cache enable row level security;
alter table public.daily_stats enable row level security;
