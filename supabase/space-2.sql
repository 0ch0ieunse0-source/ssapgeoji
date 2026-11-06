-- 거지노트 스페이스 공개 설정 + 갖고 싶은 물건 — Supabase SQL Editor에 붙여 넣고 Run
-- (space.sql을 먼저 실행한 뒤에) 칸을 '더하기'만 하고, 함수 내용을 고쳐요. 지우는 데이터는 없어요.
-- 꺼 둔 항목은 서버가 친구에게 아예 주지 않아요. 갖고 싶은 물건은 이름·끝나는 날·상태만 저장해요(가격 없음).

alter table public.geoji_profiles add column if not exists show_wish boolean not null default true;
alter table public.geoji_profiles add column if not exists show_avatar boolean not null default true;
alter table public.geoji_profiles add column if not exists show_grade boolean not null default true;
alter table public.geoji_profiles add column if not exists show_broke boolean not null default true;
alter table public.geoji_profiles add column if not exists show_visits boolean not null default true;
alter table public.geoji_profiles add column if not exists wish jsonb;  -- [{n:이름, d:YYYY-MM-DD, s:wait|skip|bought}] 최대 10개

-- 스페이스 목록: 꺼 둔 항목은 비워서 줘요 (예전 앱이 불러도 마찬가지)
create or replace function public.geoji_space_get(p_codes text[])
returns table (code text, nickname text, season date, pct smallint, grade text, broke boolean, coins int, coin_lost int, avatar text)
language sql security definer set search_path = public as $$
  select code, nickname, season,
         case when show_grade then pct end,
         case when show_grade then grade end,
         case when show_broke then broke else false end,
         coins,
         case when show_broke then coin_lost else 0 end,
         case when show_avatar then avatar end
    from geoji_profiles
   where code = any (p_codes[1:50]);
$$;

-- 갖고 싶은 물건 · 최근 동전 공개 여부 (친구 방 화면용)
create or replace function public.geoji_space_extra(p_codes text[])
returns table (code text, wish jsonb, visits boolean)
language sql security definer set search_path = public as $$
  select code, case when show_wish then wish end, show_visits
    from geoji_profiles
   where code = any (p_codes[1:50]);
$$;

-- 최근 동전: 꺼 두면 아무것도 안 줘요
create or replace function public.geoji_space_coins(p_code text)
returns table (from_nickname text, memo text, day date)
language sql security definer set search_path = public as $$
  select p.nickname, c.memo, c.day
    from geoji_coins c
    join geoji_profiles p on p.code = c.from_code
    join geoji_profiles me on me.code = c.to_code
   where c.to_code = p_code and me.show_visits
   order by c.created_at desc
   limit 20;
$$;

-- 내 공개 설정 보기 (내 비밀 열쇠가 맞을 때만)
create or replace function public.geoji_space_mine(p_code text, p_secret text)
returns jsonb language sql security definer set search_path = public, extensions as $$
  select jsonb_build_object('wish', show_wish, 'avatar', show_avatar, 'grade', show_grade, 'broke', show_broke, 'visits', show_visits)
    from geoji_profiles
   where code = p_code and secret_hash = encode(digest(p_secret, 'sha256'), 'hex');
$$;

-- 내 공개 설정 바꾸기. 갖고 싶은 물건을 끄면 저장해 둔 목록도 지워요
create or replace function public.geoji_space_set_show(p_code text, p_secret text, p_show jsonb)
returns text language plpgsql security definer set search_path = public, extensions as $$
begin
  update geoji_profiles set
    show_wish   = coalesce((p_show->>'wish')::boolean, show_wish),
    show_avatar = coalesce((p_show->>'avatar')::boolean, show_avatar),
    show_grade  = coalesce((p_show->>'grade')::boolean, show_grade),
    show_broke  = coalesce((p_show->>'broke')::boolean, show_broke),
    show_visits = coalesce((p_show->>'visits')::boolean, show_visits),
    wish = case when coalesce((p_show->>'wish')::boolean, show_wish) then wish else null end
   where code = p_code and secret_hash = encode(digest(p_secret, 'sha256'), 'hex');
  if not found then return 'denied'; end if;
  return 'ok';
end $$;

-- 갖고 싶은 물건 올리기: 이름(30자)·날짜·상태만 다시 만들어 저장해요 (다른 칸이 와도 버려요), 최대 10개
create or replace function public.geoji_wish_set(p_code text, p_secret text, p_wish jsonb)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare v jsonb;
begin
  if p_wish is not null and jsonb_typeof(p_wish) <> 'array' then return 'bad'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('n', left(e->>'n', 30), 'd', e->>'d', 's', e->>'s')), '[]'::jsonb) into v
    from (select e from jsonb_array_elements(coalesce(p_wish, '[]'::jsonb)) e limit 10) x
   where jsonb_typeof(e) = 'object'
     and coalesce(e->>'n', '') <> ''
     and (e->>'d') ~ '^\d{4}-\d{2}-\d{2}$'
     and (e->>'s') in ('wait', 'skip', 'bought');
  update geoji_profiles set wish = case when show_wish then v else null end
   where code = p_code and secret_hash = encode(digest(p_secret, 'sha256'), 'hex');
  if not found then return 'denied'; end if;
  return 'ok';
end $$;

revoke all on function public.geoji_space_extra(text[]) from public;
revoke all on function public.geoji_space_mine(text, text) from public;
revoke all on function public.geoji_space_set_show(text, text, jsonb) from public;
revoke all on function public.geoji_wish_set(text, text, jsonb) from public;
grant execute on function public.geoji_space_get(text[]) to anon;
grant execute on function public.geoji_space_coins(text) to anon;
grant execute on function public.geoji_space_extra(text[]) to anon;
grant execute on function public.geoji_space_mine(text, text) to anon;
grant execute on function public.geoji_space_set_show(text, text, jsonb) to anon;
grant execute on function public.geoji_wish_set(text, text, jsonb) to anon;
