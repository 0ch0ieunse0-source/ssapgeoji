-- 거지노트 친구 랭킹 3: 응원·콕에 메모 (선택, 40자) — SQL Editor에 붙여 넣고 Run

alter table public.geoji_pokes add column if not exists memo text check (memo is null or char_length(memo) <= 40);

drop function if exists public.geoji_poke(text, text, text, text);
create or replace function public.geoji_poke(p_code text, p_secret text, p_to text, p_kind text, p_memo text)
returns text language plpgsql security definer set search_path = public, extensions as $$
begin
  if not exists (select 1 from geoji_profiles where code = p_code and secret_hash = encode(digest(p_secret, 'sha256'), 'hex')) then
    raise exception 'denied';
  end if;
  if p_to = p_code or not exists (select 1 from geoji_profiles where code = p_to) then raise exception 'no friend'; end if;
  insert into geoji_pokes (from_code, to_code, kind, memo)
  values (p_code, p_to, p_kind, nullif(trim(left(coalesce(p_memo, ''), 40)), ''))
  on conflict (from_code, to_code, kind, day) do nothing;
  if found then return 'ok'; end if;
  return 'already';
end $$;

drop function if exists public.geoji_inbox(text, text);
create or replace function public.geoji_inbox(p_code text, p_secret text)
returns table (from_nickname text, kind text, memo text, created_at timestamptz)
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not exists (select 1 from geoji_profiles where code = p_code and secret_hash = encode(digest(p_secret, 'sha256'), 'hex')) then
    raise exception 'denied';
  end if;
  return query
    with r as (
      update geoji_pokes k set read = true
       where k.id in (select id from geoji_pokes where to_code = p_code and not read order by id desc limit 30)
       returning k.from_code, k.kind, k.memo, k.created_at
    )
    select p.nickname, r.kind, r.memo, r.created_at from r join geoji_profiles p on p.code = r.from_code
     order by r.created_at desc;
end $$;

revoke all on function public.geoji_poke(text, text, text, text, text) from public;
revoke all on function public.geoji_inbox(text, text) from public;
grant execute on function public.geoji_poke(text, text, text, text, text) to anon;
grant execute on function public.geoji_inbox(text, text) to anon;
