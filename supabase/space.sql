-- 거지노트 스페이스 (동전 · 프로필 사진) — Supabase SQL Editor에 붙여 넣고 Run
-- 랭킹 표(geoji_profiles)에 칸을 '더하기'만 하고, 동전 기록 표를 새로 만들어요. 지우거나 바꾸는 건 없어요.
-- 저장하는 것: 받은 동전 수, 동전 한마디(30자), 프로필 사진(작게 줄인 것). 금액·가계부 기록은 저장하지 않아요.

create extension if not exists pgcrypto with schema extensions;

alter table public.geoji_profiles add column if not exists coins int not null default 0;
alter table public.geoji_profiles add column if not exists coin_season date;      -- 파산 동전 깎기를 한 시즌 (한 시즌에 한 번만)
alter table public.geoji_profiles add column if not exists coin_lost int not null default 0; -- 마지막으로 파산해서 잃은 동전 (발표 화면용)
alter table public.geoji_profiles add column if not exists avatar text;           -- 프로필 사진 (data:image/jpeg;base64,…, 작게 줄인 것)

-- 동전 주기 기록: 한 사람이 같은 친구에게 하루 1개
create table if not exists public.geoji_coins (
  to_code    text not null references public.geoji_profiles(code) on delete cascade,
  from_code  text not null references public.geoji_profiles(code) on delete cascade,
  day        date not null default ((now() at time zone 'Asia/Seoul')::date),
  memo       text check (memo is null or char_length(memo) <= 30),
  created_at timestamptz not null default now(),
  primary key (to_code, from_code, day)
);
alter table public.geoji_coins enable row level security;
revoke all on public.geoji_coins from anon, authenticated;

-- 시즌 성적이 새로 올라올 때 파산이면 동전 30%를 깎아요 (동전이 있으면 최소 1개, 한 시즌에 한 번)
create or replace function public._geoji_coin_bankrupt()
returns trigger language plpgsql as $$
declare v_loss int;
begin
  if new.season is not null and new.season is distinct from old.coin_season then
    new.coin_season := new.season;
    if coalesce(new.broke, false) and old.coins > 0 then
      v_loss := greatest(1, ceil(old.coins * 0.3)::int);
      new.coins := greatest(0, old.coins - v_loss);
      new.coin_lost := v_loss;
    else
      new.coin_lost := 0;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists geoji_coin_bankrupt on public.geoji_profiles;
create trigger geoji_coin_bankrupt before update of season on public.geoji_profiles
  for each row execute function public._geoji_coin_bankrupt();

-- 동전 주고 가기 → 'ok' | 'already'(오늘 이미 줌) | 'self' | 'missing' | 'denied'
create or replace function public.geoji_coin_give(p_code text, p_secret text, p_to text, p_memo text)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare v_memo text := nullif(trim(coalesce(p_memo, '')), '');
begin
  if not exists (select 1 from geoji_profiles where code = p_code and secret_hash = encode(digest(p_secret, 'sha256'), 'hex')) then
    return 'denied';
  end if;
  if p_to = p_code then return 'self'; end if;
  if not exists (select 1 from geoji_profiles where code = p_to) then return 'missing'; end if;
  if v_memo is not null and char_length(v_memo) > 30 then v_memo := left(v_memo, 30); end if;
  insert into geoji_coins (to_code, from_code, memo) values (p_to, p_code, v_memo) on conflict do nothing;
  if not found then return 'already'; end if;
  update geoji_profiles set coins = coins + 1 where code = p_to;
  return 'ok';
end $$;

-- 스페이스 목록 (친구 코드로, 최대 50명): 랭킹 칸 + 동전 + 사진
create or replace function public.geoji_space_get(p_codes text[])
returns table (code text, nickname text, season date, pct smallint, grade text, broke boolean, coins int, coin_lost int, avatar text)
language sql security definer set search_path = public as $$
  select code, nickname, season, pct, grade, broke, coins, coin_lost, avatar
    from geoji_profiles
   where code = any (p_codes[1:50]);
$$;

-- 한 방에 최근 들른 사람 (닉네임 · 한마디 · 날짜, 최근 20개)
create or replace function public.geoji_space_coins(p_code text)
returns table (from_nickname text, memo text, day date)
language sql security definer set search_path = public as $$
  select p.nickname, c.memo, c.day
    from geoji_coins c join geoji_profiles p on p.code = c.from_code
   where c.to_code = p_code
   order by c.created_at desc
   limit 20;
$$;

-- 프로필 사진 바꾸기·지우기 (내 비밀 열쇠가 맞을 때만, 작은 JPEG만)
create or replace function public.geoji_avatar_set(p_code text, p_secret text, p_avatar text)
returns text language plpgsql security definer set search_path = public, extensions as $$
begin
  if p_avatar is not null and (p_avatar not like 'data:image/jpeg;base64,%' or char_length(p_avatar) > 40000) then
    return 'bad';
  end if;
  update geoji_profiles set avatar = p_avatar
   where code = p_code and secret_hash = encode(digest(p_secret, 'sha256'), 'hex');
  if not found then return 'denied'; end if;
  return 'ok';
end $$;

revoke all on function public._geoji_coin_bankrupt() from public;
revoke all on function public.geoji_coin_give(text, text, text, text) from public;
revoke all on function public.geoji_space_get(text[]) from public;
revoke all on function public.geoji_space_coins(text) from public;
revoke all on function public.geoji_avatar_set(text, text, text) from public;
grant execute on function public.geoji_coin_give(text, text, text, text) to anon;
grant execute on function public.geoji_space_get(text[]) to anon;
grant execute on function public.geoji_space_coins(text) to anon;
grant execute on function public.geoji_avatar_set(text, text, text) to anon;
