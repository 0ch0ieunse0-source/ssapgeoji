-- 거지노트 매일 알림(푸시) — Supabase SQL Editor에 붙여 넣고 Run
-- 새로 만들기만 해요. 랭킹·계정 표는 건드리지 않아요.
--
-- 저장하는 것: 이 폰으로 알림을 보내는 주소(endpoint)와 그 주소용 공개 열쇠 두 개, 알림 시각, 시간대, 마지막으로 보낸 날.
-- 금액·기록·메모·이름은 오지 않아요. 앱은 아래 함수로만 접근하고 표를 직접 읽을 수 없어요.
-- 보내는 쪽(Edge Function daily-push)은 서버 열쇠(service_role)로만 geoji_push_due / geoji_push_gone을 불러요.

create table if not exists public.geoji_push (
  endpoint   text primary key check (endpoint ~ '^https://' and char_length(endpoint) < 1000),
  p256dh     text not null check (char_length(p256dh) between 20 and 200),
  auth       text not null check (char_length(auth) between 8 and 100),
  hour       int  not null check (hour between 0 and 23),
  tz_min     int  not null check (tz_min between -840 and 840),
  last_sent  date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.geoji_push enable row level security;
revoke all on public.geoji_push from anon, authenticated;

-- 켜기·시간 바꾸기 (같은 주소면 고쳐요)
create or replace function public.geoji_push_sub(p_endpoint text, p_p256dh text, p_auth text, p_hour int, p_tz int)
returns void language plpgsql security definer set search_path = public as $$
declare
  loc timestamp := (now() at time zone 'utc') + make_interval(mins => p_tz);
begin
  if (select count(*) from geoji_push) > 200000 then raise exception 'full'; end if;
  insert into geoji_push (endpoint, p256dh, auth, hour, tz_min, last_sent)
  -- 알림 시간이 이미 지난 뒤에 켜면 오늘은 보내지 않고 내일부터 보내요
  values (p_endpoint, p_p256dh, p_auth, p_hour, p_tz, case when extract(hour from loc) >= p_hour then loc::date end)
  on conflict (endpoint) do update
    set p256dh = excluded.p256dh, auth = excluded.auth, hour = excluded.hour, tz_min = excluded.tz_min, updated_at = now();
end $$;

-- 끄기
create or replace function public.geoji_push_unsub(p_endpoint text)
returns void language sql security definer set search_path = public as $$
  delete from geoji_push where endpoint = p_endpoint;
$$;

-- 지금 보낼 차례인 폰들을 고르고, 오늘 보낸 걸로 표시해요 (두 번 가지 않게 고르면서 바로 표시)
create or replace function public.geoji_push_due()
returns table (endpoint text, p256dh text, auth text) language sql security definer set search_path = public as $$
  update geoji_push g
     set last_sent = ((now() at time zone 'utc') + make_interval(mins => g.tz_min))::date
   where extract(hour from (now() at time zone 'utc') + make_interval(mins => g.tz_min)) between g.hour and g.hour + 1
     and (g.last_sent is null or g.last_sent < ((now() at time zone 'utc') + make_interval(mins => g.tz_min))::date)
  returning g.endpoint, g.p256dh, g.auth;
$$;

-- 더는 없는 주소(앱을 지웠거나 알림을 끈 폰)는 지워요
create or replace function public.geoji_push_gone(p_endpoints text[])
returns void language sql security definer set search_path = public as $$
  delete from geoji_push where endpoint = any(p_endpoints);
$$;

revoke all on function public.geoji_push_sub(text, text, text, int, int) from public;
revoke all on function public.geoji_push_unsub(text) from public;
revoke all on function public.geoji_push_due() from public, anon, authenticated;
revoke all on function public.geoji_push_gone(text[]) from public, anon, authenticated;
grant execute on function public.geoji_push_sub(text, text, text, int, int) to anon, authenticated;
grant execute on function public.geoji_push_unsub(text) to anon, authenticated;
grant execute on function public.geoji_push_due() to service_role;
grant execute on function public.geoji_push_gone(text[]) to service_role;

-- 15분마다 보내는 함수(daily-push)를 불러요. 'CRON_SECRET'은 함수 비밀값 PUSH_CRON_SECRET과 같은 값으로 바꿔서 실행해요.
create extension if not exists pg_cron;
create extension if not exists pg_net;
select vault.create_secret('CRON_SECRET', 'geoji_push_cron')
 where not exists (select 1 from vault.secrets where name = 'geoji_push_cron');
select cron.schedule(
  'geoji-daily-push',
  '*/15 * * * *',
  $$ select net.http_post(
       url := 'https://twgsogcptjkodauoojos.supabase.co/functions/v1/daily-push',
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'geoji_push_cron')
       ),
       body := '{}'::jsonb
     ) $$
);
