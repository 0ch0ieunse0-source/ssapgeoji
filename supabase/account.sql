-- 거지노트 계정 (선택) — Supabase SQL Editor에 붙여 넣고 Run
-- 새로 만들기만 해요. 랭킹 표(geoji_profiles 등)는 건드리지 않아요.
--
-- 저장하는 것: 아이디, 출입증을 한 번 더 바꾼 값(sha256), 잠긴 기록 열쇠, 잠긴 기록, 버전.
-- 금액·메모·이름 같은 기록 내용은 폰에서 잠근 뒤에만 와요. 서버(와 이 표를 보는 사람)는 열 수 없어요.
-- 비밀번호 자체는 오지 않아요.
-- 앱은 아래 함수로만 접근할 수 있고, 표를 직접 읽거나 고칠 수 없어요.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.geoji_vaults (
  username     text primary key check (username ~ '^[a-z0-9_]{4,16}$'),
  auth_hash    text not null,
  salt         text not null,
  kdf_iter     int  not null check (kdf_iter >= 100000),
  wrapped_key  text not null,
  blob         text not null check (char_length(blob) < 4000000),
  version      int  not null default 1,
  fail_count   int  not null default 0,
  locked_until timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
alter table public.geoji_vaults enable row level security;
revoke all on public.geoji_vaults from anon, authenticated;

-- 예전 버전 (최근 10개). 잘못 합쳐졌거나 실수로 지웠을 때 되돌리기용
create table if not exists public.geoji_vault_history (
  username   text not null references public.geoji_vaults(username) on delete cascade,
  version    int  not null,
  blob       text not null,
  created_at timestamptz not null default now(),
  primary key (username, version)
);
alter table public.geoji_vault_history enable row level security;
revoke all on public.geoji_vault_history from anon, authenticated;

-- 출입증 확인. 10번 틀리면 15분 잠가요. (틀린 횟수가 저장되도록 예외 대신 결과로 돌려줘요)
create or replace function public._geoji_v_check(p_id text, p_auth text)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare v geoji_vaults;
begin
  select * into v from geoji_vaults where username = p_id for update;
  if not found then return 'denied'; end if;
  if v.locked_until is not null and v.locked_until > now() then return 'locked'; end if;
  if v.auth_hash = encode(digest(coalesce(p_auth, ''), 'sha256'), 'hex') then
    update geoji_vaults set fail_count = 0, locked_until = null where username = p_id;
    return 'ok';
  end if;
  update geoji_vaults
     set fail_count = v.fail_count + 1,
         locked_until = case when v.fail_count + 1 >= 10 then now() + interval '15 minutes' else null end
   where username = p_id;
  return 'denied';
end $$;
revoke all on function public._geoji_v_check(text, text) from public, anon, authenticated;

-- 로그인 첫 단계: 아이디의 소금값 (없으면 null = 쓸 수 있는 아이디)
create or replace function public.geoji_v_salt(p_id text)
returns jsonb language sql security definer set search_path = public as $$
  select jsonb_build_object('salt', salt, 'iter', kdf_iter) from geoji_vaults where username = p_id;
$$;

-- 가입: 이 폰 기록을 잠근 채 첫 버전으로 올려요
create or replace function public.geoji_v_create(p_id text, p_auth text, p_salt text, p_iter int, p_wrapped text, p_blob text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  if p_id !~ '^[a-z0-9_]{4,16}$' then return jsonb_build_object('ok', false, 'error', 'bad_id'); end if;
  if char_length(coalesce(p_auth, '')) <> 64 then return jsonb_build_object('ok', false, 'error', 'bad_auth'); end if;
  if exists (select 1 from geoji_vaults where username = p_id) then return jsonb_build_object('ok', false, 'error', 'taken'); end if;
  insert into geoji_vaults (username, auth_hash, salt, kdf_iter, wrapped_key, blob)
  values (p_id, encode(digest(p_auth, 'sha256'), 'hex'), p_salt, p_iter, p_wrapped, p_blob);
  return jsonb_build_object('ok', true, 'version', 1);
end $$;

-- 내 잠긴 기록 받기
create or replace function public.geoji_v_get(p_id text, p_auth text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s text; v geoji_vaults;
begin
  s := _geoji_v_check(p_id, p_auth);
  if s <> 'ok' then return jsonb_build_object('ok', false, 'error', s); end if;
  select * into v from geoji_vaults where username = p_id;
  return jsonb_build_object('ok', true, 'wrapped', v.wrapped_key, 'blob', v.blob, 'version', v.version, 'updated_at', v.updated_at);
end $$;

-- 버전만 보기 (앱을 열 때 서버가 더 새로운지 확인)
create or replace function public.geoji_v_version(p_id text, p_auth text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s text;
begin
  s := _geoji_v_check(p_id, p_auth);
  if s <> 'ok' then return jsonb_build_object('ok', false, 'error', s); end if;
  return (select jsonb_build_object('ok', true, 'version', version) from geoji_vaults where username = p_id);
end $$;

-- 올리기: 내가 알던 버전(p_base)이 서버와 같을 때만 덮어써요. 다르면 서버 것을 돌려줘서 폰에서 합치게 해요.
create or replace function public.geoji_v_put(p_id text, p_auth text, p_base int, p_blob text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s text; v geoji_vaults;
begin
  s := _geoji_v_check(p_id, p_auth);
  if s <> 'ok' then return jsonb_build_object('ok', false, 'error', s); end if;
  select * into v from geoji_vaults where username = p_id for update;
  if v.version <> p_base then
    return jsonb_build_object('ok', false, 'error', 'conflict', 'version', v.version, 'blob', v.blob);
  end if;
  insert into geoji_vault_history (username, version, blob) values (p_id, v.version, v.blob) on conflict do nothing;
  delete from geoji_vault_history where username = p_id and version <= v.version - 10;
  update geoji_vaults set blob = p_blob, version = v.version + 1, updated_at = now() where username = p_id;
  return jsonb_build_object('ok', true, 'version', v.version + 1);
end $$;

-- 예전 버전 목록 / 하나 받기 (되돌리기는 받은 걸 폰에서 열어 보고 다시 올려요)
create or replace function public.geoji_v_history(p_id text, p_auth text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s text;
begin
  s := _geoji_v_check(p_id, p_auth);
  if s <> 'ok' then return jsonb_build_object('ok', false, 'error', s); end if;
  return jsonb_build_object('ok', true, 'list', coalesce((
    select jsonb_agg(jsonb_build_object('version', version, 'at', created_at) order by version desc)
      from geoji_vault_history where username = p_id), '[]'::jsonb));
end $$;

create or replace function public.geoji_v_history_get(p_id text, p_auth text, p_version int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s text;
begin
  s := _geoji_v_check(p_id, p_auth);
  if s <> 'ok' then return jsonb_build_object('ok', false, 'error', s); end if;
  return coalesce((select jsonb_build_object('ok', true, 'blob', blob) from geoji_vault_history where username = p_id and version = p_version),
                  jsonb_build_object('ok', false, 'error', 'missing'));
end $$;

-- 비밀번호 바꾸기: 로그인된 폰이 가진 지금 출입증으로만. 기록 열쇠는 그대로, 상자만 새로 잠가요.
create or replace function public.geoji_v_rekey(p_id text, p_auth text, p_new_auth text, p_salt text, p_iter int, p_wrapped text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare s text;
begin
  s := _geoji_v_check(p_id, p_auth);
  if s <> 'ok' then return jsonb_build_object('ok', false, 'error', s); end if;
  if char_length(coalesce(p_new_auth, '')) <> 64 then return jsonb_build_object('ok', false, 'error', 'bad_auth'); end if;
  update geoji_vaults
     set auth_hash = encode(digest(p_new_auth, 'sha256'), 'hex'), salt = p_salt, kdf_iter = p_iter, wrapped_key = p_wrapped, updated_at = now()
   where username = p_id;
  return jsonb_build_object('ok', true);
end $$;

-- 계정 지우기: 서버의 잠긴 기록과 예전 버전을 모두 지워요 (폰 기록은 그대로)
create or replace function public.geoji_v_delete(p_id text, p_auth text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s text;
begin
  s := _geoji_v_check(p_id, p_auth);
  if s <> 'ok' then return jsonb_build_object('ok', false, 'error', s); end if;
  delete from geoji_vaults where username = p_id;
  return jsonb_build_object('ok', true);
end $$;

grant execute on function public.geoji_v_salt(text) to anon;
grant execute on function public.geoji_v_create(text, text, text, int, text, text) to anon;
grant execute on function public.geoji_v_get(text, text) to anon;
grant execute on function public.geoji_v_version(text, text) to anon;
grant execute on function public.geoji_v_put(text, text, int, text) to anon;
grant execute on function public.geoji_v_history(text, text) to anon;
grant execute on function public.geoji_v_history_get(text, text, int) to anon;
grant execute on function public.geoji_v_rekey(text, text, text, text, int, text) to anon;
grant execute on function public.geoji_v_delete(text, text) to anon;
