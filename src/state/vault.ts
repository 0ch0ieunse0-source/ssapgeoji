/** 계정(선택): 잠근 기록을 서버와 주고받아요.
 *  - 폰 기록(aggim-v1)이 언제나 먼저예요. 서버는 그 사본을 잠가서 보관할 뿐이에요.
 *  - 서버에서 받은 걸로 폰 기록을 '덮어쓰지' 않아요. 항상 합쳐요(merge3). 합치기 전 폰 기록은 따로 한 벌 남겨요.
 *  - 서버로 가는 건 아이디, 출입증, 잠긴 열쇠, 잠긴 기록뿐이에요. (vault.test.ts·account.test.ts가 지켜요)
 */
import { merge3 } from "../lib/merge";
import { normalize } from "../lib/storage";
import type { Data, Key } from "../lib/types";
import { deriveKeys, KDF_ITER, newDataKey, newSalt, seal, unseal, unwrapDataKey, wrapDataKey } from "../lib/vault";
import { rpc } from "./rank";

const SESSION_KEY = "ssapgeoji-vault";
const BASE_KEY = "ssapgeoji-vault-base"; // 마지막으로 서버와 맞춘 기록 (합칠 때 기준)
const SAFETY_KEY = "ssapgeoji-before-sync"; // 서버 기록과 합치기 직전의 폰 기록 (만일을 위해)

export interface Session {
  id: string;
  auth: string; // 출입증 (이 폰에만)
  dk: string; // 기록 열쇠 (이 폰에만)
  version: number; // 마지막으로 맞춘 서버 버전
  syncedAt: number | null;
}

const get = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const set = (k: string, v: string | null) => {
  try {
    if (v == null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {
    /* 저장이 막혀 있으면 다음에 다시 해요 */
  }
};

export function loadSession(): Session | null {
  try {
    const s = JSON.parse(get(SESSION_KEY) || "null");
    return s && typeof s.id === "string" && typeof s.auth === "string" && typeof s.dk === "string" ? s : null;
  } catch {
    return null;
  }
}
const LAST_ID_KEY = "ssapgeoji-vault-last"; // 마지막으로 쓴 아이디 (다시 로그인할 때 채워 두기)
const saveSession = (s: Session | null) => {
  set(SESSION_KEY, s ? JSON.stringify(s) : null);
  if (s) set(LAST_ID_KEY, s.id);
};
export const lastId = () => get(LAST_ID_KEY) || "";
const loadBase = (): Data | undefined => {
  try {
    const b = JSON.parse(get(BASE_KEY) || "null");
    return b || undefined;
  } catch {
    return undefined;
  }
};
const saveBase = (d: Data | null) => set(BASE_KEY, d ? JSON.stringify(d) : null);

type R<T = object> = ({ ok: true } & T) | { ok: false; error: string; version?: number; blob?: string };

export class AccountError extends Error {}
const fail = (code: string): never => {
  throw new AccountError(code);
};

/** 아이디를 쓸 수 있는지 (true = 비어 있어요) */
export async function idAvailable(id: string): Promise<boolean> {
  return (await rpc<unknown>("geoji_v_salt", { p_id: id })) == null;
}

/** 가입: 지금 폰 기록을 잠가서 첫 버전으로 올려요 */
export async function signUp(id: string, password: string, data: Data): Promise<Session> {
  const salt = newSalt();
  const { auth, kek } = await deriveKeys(password, salt);
  const dk = newDataKey();
  const r = await rpc<R<{ version: number }>>("geoji_v_create", {
    p_id: id,
    p_auth: auth,
    p_salt: salt,
    p_iter: KDF_ITER,
    p_wrapped: await wrapDataKey(dk, kek),
    p_blob: await seal(data, dk),
  });
  if (!r.ok) fail(r.error);
  const s: Session = { id, auth, dk, version: (r as { version: number }).version, syncedAt: Date.now() };
  saveSession(s);
  saveBase(data);
  return s;
}

/** 로그인: 서버 기록을 받아 폰 기록과 합쳐요 (아무것도 지우지 않는 합치기). 합친 결과를 돌려줘요 */
export async function logIn(id: string, password: string, local: Data, today: Key): Promise<Data> {
  const salt = await rpc<{ salt: string; iter: number } | null>("geoji_v_salt", { p_id: id });
  if (!salt) fail("no_account");
  const { auth, kek } = await deriveKeys(password, salt!.salt, salt!.iter);
  const r = await rpc<R<{ wrapped: string; blob: string; version: number }>>("geoji_v_get", { p_id: id, p_auth: auth });
  if (!r.ok) fail(r.error);
  const got = r as { wrapped: string; blob: string; version: number };
  const dk = await unwrapDataKey(got.wrapped, kek).catch(() => fail("denied"));
  return finishLogin(id, auth, dk, got, local, today);
}

/** 로그인 마무리 (비밀번호·Face ID 둘 다): 세션 저장 → 서버 기록과 폰 기록 합치기 */
export async function finishLogin(id: string, auth: string, dk: string, got: { blob: string; version: number }, local: Data, today: Key): Promise<Data> {
  const remote = normalize(await unseal(got.blob, dk), today);
  const s: Session = { id, auth, dk, version: got.version, syncedAt: Date.now() };
  saveSession(s);
  let merged: Data;
  if (!local.settings && !Object.keys(local.days).length) merged = remote;
  else {
    set(SAFETY_KEY, JSON.stringify(local));
    merged = normalize(merge3(undefined, local, remote), today);
  }
  saveBase(remote);
  if (JSON.stringify(merged) !== JSON.stringify(remote)) await push(merged, today);
  else saveBase(merged);
  return merged;
}

/** 올리기. 다른 기기가 먼저 올렸으면 받아서 합친 뒤 다시 올려요. 합친 결과(바뀌었으면)를 돌려줘요 */
export async function push(local: Data, today: Key): Promise<Data | null> {
  let s = loadSession();
  if (!s) return null;
  let cur = local;
  for (let i = 0; i < 3; i++) {
    const ss: Session = s;
    const blob = await seal(cur, ss.dk);
    const r: R<{ version: number }> = await rpc<R<{ version: number }>>("geoji_v_put", { p_id: ss.id, p_auth: ss.auth, p_base: ss.version, p_blob: blob });
    if (r.ok) {
      s = { ...ss, version: (r as { version: number }).version, syncedAt: Date.now() };
      saveSession(s);
      saveBase(cur);
      return cur === local ? null : cur;
    }
    if (r.error !== "conflict" || !r.blob || r.version == null) fail(r.error);
    const remote = normalize(await unseal(r.blob!, ss.dk), today);
    set(SAFETY_KEY, JSON.stringify(cur));
    cur = normalize(merge3(loadBase(), cur, remote), today);
    s = { ...ss, version: r.version! };
    saveSession(s);
    saveBase(remote);
  }
  return fail("busy");
}

/** 앱을 열 때: 서버가 더 새로우면 받아서 합쳐요. 합친 결과(바뀌었으면)를 돌려줘요 */
export async function pull(local: Data, today: Key): Promise<Data | null> {
  const s = loadSession();
  if (!s) return null;
  const v = await rpc<R<{ version: number }>>("geoji_v_version", { p_id: s.id, p_auth: s.auth });
  if (!v.ok) fail(v.error);
  if ((v as { version: number }).version === s.version) {
    // 서버는 그대로인데 이 폰에서 못 올린 게 있으면 올려요
    if (JSON.stringify(loadBase()) !== JSON.stringify(local)) return push(local, today);
    return null;
  }
  const r = await rpc<R<{ blob: string; version: number }>>("geoji_v_get", { p_id: s.id, p_auth: s.auth });
  if (!r.ok) fail(r.error);
  const got = r as { blob: string; version: number };
  const remote = normalize(await unseal(got.blob, s.dk), today);
  set(SAFETY_KEY, JSON.stringify(local));
  const merged = normalize(merge3(loadBase(), local, remote), today);
  saveSession({ ...s, version: got.version, syncedAt: Date.now() });
  saveBase(remote);
  if (JSON.stringify(merged) !== JSON.stringify(remote)) await push(merged, today);
  else saveBase(merged);
  return JSON.stringify(merged) === JSON.stringify(local) ? null : merged;
}

/** 마지막으로 서버와 맞춘 뒤 이 폰에서 바뀐 게 있는지 */
export const needsPush = (local: Data) => JSON.stringify(loadBase()) !== JSON.stringify(local);

/** 비밀번호 바꾸기: 로그인된 이 폰의 출입증으로만 (예전 비밀번호 몰라도 돼요) */
export async function changePassword(password: string): Promise<void> {
  const s = loadSession();
  if (!s) return fail("no_session");
  const salt = newSalt();
  const { auth, kek } = await deriveKeys(password, salt);
  const r = await rpc<R>("geoji_v_rekey", { p_id: s.id, p_auth: s.auth, p_new_auth: auth, p_salt: salt, p_iter: KDF_ITER, p_wrapped: await wrapDataKey(s.dk, kek) });
  if (!r.ok) fail(r.error);
  saveSession({ ...s, auth });
}

export async function historyList(): Promise<{ version: number; at: string }[]> {
  const s = loadSession();
  if (!s) return [];
  const r = await rpc<R<{ list: { version: number; at: string }[] }>>("geoji_v_history", { p_id: s.id, p_auth: s.auth });
  if (!r.ok) fail(r.error);
  return (r as { list: { version: number; at: string }[] }).list;
}
export async function historyGet(version: number, today: Key): Promise<Data> {
  const s = loadSession();
  if (!s) return fail("no_session");
  const r = await rpc<R<{ blob: string }>>("geoji_v_history_get", { p_id: s.id, p_auth: s.auth, p_version: version });
  if (!r.ok) fail(r.error);
  return normalize(await unseal((r as { blob: string }).blob, s.dk), today);
}

/** 로그아웃: 이 폰의 출입증·열쇠만 지워요. 폰 기록(aggim-v1)은 그대로 둬요 */
export function logOut() {
  saveSession(null);
  saveBase(null);
}

/** 계정 지우기: 서버 기록을 지워요. 폰 기록은 그대로 */
export async function deleteAccount(): Promise<void> {
  const s = loadSession();
  if (!s) return;
  const r = await rpc<R>("geoji_v_delete", { p_id: s.id, p_auth: s.auth });
  if (!r.ok) fail(r.error);
  logOut();
}

export const ERROR_TEXT: Record<string, string> = {
  taken: "이미 있는 아이디예요. 다른 아이디를 써 주세요.",
  no_account: "없는 아이디예요. 아이디를 다시 확인해 주세요.",
  denied: "아이디나 비밀번호가 맞지 않아요.",
  locked: "여러 번 틀려서 15분 동안 잠겼어요. 잠시 뒤에 다시 해 주세요.",
  bad_id: "아이디는 영어 소문자·숫자·밑줄로 4~16자예요.",
  busy: "다른 기기와 동시에 저장하고 있어요. 잠시 뒤 다시 해 주세요.",
  passkey_cancel: "Face ID를 취소했어요.",
  passkey_unsupported: "이 폰(브라우저)은 Face ID 로그인을 지원하지 않아요. 아이디로 로그인해 주세요.",
  passkey_gone: "이 Face ID는 더 이상 쓸 수 없어요. 비밀번호를 바꿨다면 아이디로 로그인한 뒤 Face ID를 다시 켜 주세요.",
  too_many: "Face ID는 기기 10개까지 켤 수 있어요.",
};
export const errorText = (e: unknown) =>
  e instanceof AccountError ? ERROR_TEXT[e.message] || "잠시 뒤에 다시 해 주세요." : "인터넷 연결을 확인하고 다시 해 주세요.";
