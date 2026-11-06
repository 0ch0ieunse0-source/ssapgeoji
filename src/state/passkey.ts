/** Face ID·지문(패스키)으로 로그인하기 (선택)
 *
 *  패스키의 PRF 기능으로 '그 패스키로만 만들 수 있는 값'을 받아 열쇠로 써요.
 *  그 열쇠로 {출입증, 기록 열쇠} 묶음을 잠가 서버에 두고, Face ID로 PRF 값을 다시 받아 열어요.
 *  서버는 패스키 id와 잠긴 묶음만 알아요. 생체 정보는 폰 밖으로 나가지 않아요(폰이 처리).
 *  패스키는 iCloud 키체인·구글 비밀번호 관리자에 저장돼서 폰을 바꿔도 따라와요.
 */
import type { Data, Key } from "../lib/types";
import { b64url, kekFromPrf, openWith, sealWith } from "../lib/vault";
import { rpc } from "./rank";
import { ACCOUNT_PREFIX, AccountError, finishLogin, loadSession } from "./vault";

const PRF_SALT = new TextEncoder().encode("ssapgeoji-passkey-prf-v1");
const LOCAL_KEY = ACCOUNT_PREFIX + "passkey"; // 이 폰에서 켠 패스키 id (메뉴 표시용)
const rand = (n: number) => crypto.getRandomValues(new Uint8Array(n));

type PrfResults = { prf?: { enabled?: boolean; results?: { first?: ArrayBuffer } } };

export const passkeyOnThisPhone = () => {
  try {
    return localStorage.getItem(LOCAL_KEY);
  } catch {
    return null;
  }
};
const setLocal = (v: string | null) => {
  try {
    if (v) localStorage.setItem(LOCAL_KEY, v);
    else localStorage.removeItem(LOCAL_KEY);
  } catch {
    /* 메뉴 표시용이라 실패해도 괜찮아요 */
  }
};

/** 이 브라우저가 Face ID 로그인(패스키 + PRF)을 쓸 수 있는지. 확실히 안 되면 false */
export async function passkeySupported(): Promise<boolean> {
  try {
    const PKC = window.PublicKeyCredential as unknown as
      | { isUserVerifyingPlatformAuthenticatorAvailable(): Promise<boolean>; getClientCapabilities?: () => Promise<Record<string, boolean>> }
      | undefined;
    if (!PKC || !navigator.credentials) return false;
    if (!(await PKC.isUserVerifyingPlatformAuthenticatorAvailable())) return false;
    if (PKC.getClientCapabilities) {
      const caps = await PKC.getClientCapabilities();
      if (caps && caps["extension:prf"] === false) return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function prfGet(credId?: ArrayBuffer): Promise<{ id: string; prf: ArrayBuffer }> {
  const cred = (await navigator.credentials.get({
    publicKey: {
      challenge: rand(32),
      rpId: location.hostname,
      userVerification: "required",
      timeout: 60000,
      ...(credId ? { allowCredentials: [{ type: "public-key", id: credId }] } : {}),
      extensions: { prf: { eval: { first: PRF_SALT } } } as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new AccountError("passkey_cancel");
  const prf = (cred.getClientExtensionResults() as PrfResults).prf?.results?.first;
  if (!prf) throw new AccountError("passkey_unsupported");
  return { id: b64url(new Uint8Array(cred.rawId)), prf };
}

/** 로그인된 폰에서 Face ID 켜기 */
export async function registerPasskey(): Promise<void> {
  const s = loadSession();
  if (!s) throw new AccountError("no_session");
  let cred: PublicKeyCredential | null;
  try {
    cred = (await navigator.credentials.create({
      publicKey: {
        rp: { name: "거지노트", id: location.hostname },
        user: { id: rand(16), name: s.id, displayName: s.id + " (거지노트)" },
        challenge: rand(32),
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },
          { type: "public-key", alg: -257 },
        ],
        authenticatorSelection: { residentKey: "required", requireResidentKey: true, userVerification: "required" },
        timeout: 60000,
        extensions: { prf: { eval: { first: PRF_SALT } } } as AuthenticationExtensionsClientInputs,
      },
    })) as PublicKeyCredential | null;
  } catch (e) {
    throw new AccountError((e as Error)?.name === "NotAllowedError" ? "passkey_cancel" : "passkey_unsupported");
  }
  if (!cred) throw new AccountError("passkey_cancel");
  const ext = cred.getClientExtensionResults() as PrfResults;
  if (ext.prf?.enabled === false) throw new AccountError("passkey_unsupported");
  // 만들 때 PRF 값을 안 주는 브라우저가 있어서, 없으면 한 번 더 Face ID로 받아요
  const got = ext.prf?.results?.first ? { id: b64url(new Uint8Array(cred.rawId)), prf: ext.prf.results.first } : await prfGet(cred.rawId);
  const wrapped = await sealWith(await kekFromPrf(got.prf), { auth: s.auth, dk: s.dk });
  const r = await rpc<{ ok: boolean; error?: string }>("geoji_v_pk_add", { p_id: s.id, p_auth: s.auth, p_cred: got.id, p_wrapped: wrapped });
  if (!r.ok) throw new AccountError(r.error || "denied");
  setLocal(got.id);
}

/** Face ID로 로그인 (아이디·비밀번호 없이) */
export async function loginWithPasskey(local: Data, today: Key): Promise<Data> {
  let got: { id: string; prf: ArrayBuffer };
  try {
    got = await prfGet();
  } catch (e) {
    if (e instanceof AccountError) throw e;
    throw new AccountError((e as Error)?.name === "NotAllowedError" ? "passkey_cancel" : "passkey_unsupported");
  }
  const r = await rpc<{ ok: boolean; error?: string; username?: string; wrapped?: string }>("geoji_v_pk_get", { p_cred: got.id });
  if (!r.ok || !r.username || !r.wrapped) throw new AccountError("passkey_gone");
  const { auth, dk } = await openWith<{ auth: string; dk: string }>(await kekFromPrf(got.prf), r.wrapped).catch(() => {
    throw new AccountError("passkey_gone");
  });
  const v = await rpc<{ ok: boolean; error?: string; blob?: string; version?: number }>("geoji_v_get", { p_id: r.username, p_auth: auth });
  if (!v.ok) throw new AccountError(v.error === "denied" ? "passkey_gone" : v.error || "denied");
  setLocal(got.id);
  return finishLogin(r.username, auth, dk, { blob: v.blob!, version: v.version! }, local, today);
}

/** 이 폰의 Face ID 끄기 (서버의 묶음도 지워요) */
export async function removePasskey(): Promise<void> {
  const s = loadSession();
  const id = passkeyOnThisPhone();
  if (s && id) await rpc("geoji_v_pk_remove", { p_id: s.id, p_auth: s.auth, p_cred: id }).catch(() => null);
  setLocal(null);
}
export const forgetPasskeyHere = () => setLocal(null);
