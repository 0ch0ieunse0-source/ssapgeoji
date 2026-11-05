-- 거지노트 친구 랭킹 2: 응원·콕 찌르기 — SQL Editor에 붙여 넣고 Run
-- 저장하는 것: 보낸 사람 코드, 받는 사람 코드, 종류(응원/콕), 시간. 금액은 없어요.

create table if not exists public.geoji_pokes (
  id         bigint generated always as identity primary key,
  from_code  text not null references public.geoji_profiles (code) on delete cascade,
  to_code    text not null references public.geoji_profiles (code) on delete cascade,
  kind       text not null check (kind in ('cheer', 'poke')),
  day        date not null default (now() at time zone 'Asia/Seoul')::date,
  read       boolean not null default false,
  created_at timestamptz not null default now(),
  unique (from_code, to_code, kind, day)
);
alter table public.geoji_pokes enable row level security;
revoke all on public.geoji_pokes from anon, authenticated;

-- 보내기 (하루에 친구마다 응원 1번, 콕 1번)
create or replace function public.geoji_poke(p_code text, p_secret text, p_to text, p_kind text)
returns text language plpgsql security definer set search_path = public, extensions as $$
begin
  if not exists (select 1 from geoji_profiles where code = p_code and secret_hash = encode(digest(p_secret, 'sha256'), 'hex')) then
    raise exception 'denied';
  end if;
  if p_to = p_code or not exists (select 1 from geoji_profiles where code = p_to) then raise exception 'no friend'; end if;
  insert into geoji_pokes (from_code, to_code, kind) values (p_code, p_to, p_kind)
  on conflict (from_code, to_code, kind, day) do nothing;
  if found then return 'ok'; end if;
  return 'already';
end $$;

-- 받은 것 확인 (읽음 처리하면서 돌려줘요)
create or replace function public.geoji_inbox(p_code text, p_secret text)
returns table (from_nickname text, kind text, created_at timestamptz)
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not exists (select 1 from geoji_profiles where code = p_code and secret_hash = encode(digest(p_secret, 'sha256'), 'hex')) then
    raise exception 'denied';
  end if;
  return query
    with r as (
      update geoji_pokes k set read = true
       where k.id in (select id from geoji_pokes where to_code = p_code and not read order by id desc limit 30)
       returning k.from_code, k.kind, k.created_at
    )
    select p.nickname, r.kind, r.created_at from r join geoji_profiles p on p.code = r.from_code
     order by r.created_at desc;
end $$;

revoke all on function public.geoji_poke(text, text, text, text) from public;
revoke all on function public.geoji_inbox(text, text) from public;
grant execute on function public.geoji_poke(text, text, text, text) to anon;
grant execute on function public.geoji_inbox(text, text) to anon;
