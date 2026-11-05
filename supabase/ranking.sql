-- 거지노트 친구 랭킹 — Supabase SQL Editor에 붙여 넣고 Run
-- 저장하는 것: 친구 코드, 닉네임, 시즌, 지킴률, 등급, 파산 여부. 금액은 저장하지 않아요.
-- 앱은 아래 함수 4개로만 접근할 수 있고, 표를 직접 읽거나 고칠 수 없어요.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.geoji_profiles (
  code        text primary key,
  nickname    text not null check (char_length(nickname) between 1 and 12),
  secret_hash text not null,
  season      date,
  pct         smallint check (pct between 0 and 100),
  grade       text check (grade in ('꽃거지', '알뜰거지', '보통거지', '흔들거지', '핵거지')),
  broke       boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.geoji_profiles enable row level security;
revoke all on public.geoji_profiles from anon, authenticated;

-- 프로필 만들기 → 친구 코드 돌려줌
create or replace function public.geoji_create(p_nickname text, p_secret text)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare
  v_code text;
  v_try int := 0;
  v_abc text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  if char_length(trim(p_nickname)) not between 1 and 12 then raise exception 'bad nickname'; end if;
  if char_length(p_secret) < 32 then raise exception 'bad secret'; end if;
  loop
    v_code := 'GEOJI-';
    for i in 1..6 loop
      v_code := v_code || substr(v_abc, 1 + (get_byte(gen_random_bytes(1), 0) % 32), 1);
    end loop;
    exit when not exists (select 1 from geoji_profiles where code = v_code);
    v_try := v_try + 1;
    if v_try > 20 then raise exception 'busy'; end if;
  end loop;
  insert into geoji_profiles (code, nickname, secret_hash)
  values (v_code, trim(p_nickname), encode(digest(p_secret, 'sha256'), 'hex'));
  return v_code;
end $$;

-- 내 성적 올리기 (내 폰의 비밀 열쇠가 맞을 때만)
create or replace function public.geoji_submit(
  p_code text, p_secret text, p_nickname text, p_season date, p_pct int, p_grade text, p_broke boolean
) returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if char_length(trim(p_nickname)) not between 1 and 12 then raise exception 'bad nickname'; end if;
  update geoji_profiles
     set nickname = trim(p_nickname), season = p_season, pct = p_pct, grade = p_grade,
         broke = coalesce(p_broke, false), updated_at = now()
   where code = p_code and secret_hash = encode(digest(p_secret, 'sha256'), 'hex');
  if not found then raise exception 'denied'; end if;
end $$;

-- 친구들 성적 보기 (친구 코드로, 최대 50명)
create or replace function public.geoji_get(p_codes text[])
returns table (code text, nickname text, season date, pct smallint, grade text, broke boolean)
language sql security definer set search_path = public as $$
  select code, nickname, season, pct, grade, broke
    from geoji_profiles
   where code = any (p_codes[1:50]);
$$;

-- 랭킹 그만하기 (내 프로필 삭제)
create or replace function public.geoji_delete(p_code text, p_secret text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  delete from geoji_profiles where code = p_code and secret_hash = encode(digest(p_secret, 'sha256'), 'hex');
end $$;

revoke all on function public.geoji_create(text, text) from public;
revoke all on function public.geoji_submit(text, text, text, date, int, text, boolean) from public;
revoke all on function public.geoji_get(text[]) from public;
revoke all on function public.geoji_delete(text, text) from public;
grant execute on function public.geoji_create(text, text) to anon;
grant execute on function public.geoji_submit(text, text, text, date, int, text, boolean) to anon;
grant execute on function public.geoji_get(text[]) to anon;
grant execute on function public.geoji_delete(text, text) to anon;
