// 계정 기록 잠그기 (브라우저 내장 암호화 WebCrypto만 써요. 외부 라이브러리 없음)
//
// 비밀번호 ─PBKDF2(60만 번)→ 바탕값 ─┬─ HKDF "geoji-auth" → 출입증 (서버로 보내요. 서버는 이걸 bcrypt로 한 번 더 바꿔 저장)
//                                    └─ HKDF "geoji-kek"  → 열쇠 상자 열쇠 (폰 밖으로 안 나가요)
// 기록 열쇠(무작위 AES-256) 를 '열쇠 상자 열쇠'로 잠가 서버에 같이 둬요. 비밀번호를 바꾸면 상자만 다시 잠그면 돼요.
// 기록은 기록 열쇠로 AES-GCM 잠금 → 서버에는 알아볼 수 없는 글자만 가요.

export const KDF_ITER = 600_000;
const te = new TextEncoder();
const td = new TextDecoder();

export const b64 = (u: Uint8Array) => {
  let s = "";
  u.forEach((x) => (s += String.fromCharCode(x)));
  return btoa(s);
};
export const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const hex = (u: Uint8Array) => Array.from(u, (x) => x.toString(16).padStart(2, "0")).join("");
const rand = (n: number) => crypto.getRandomValues(new Uint8Array(n));

/** 아이디: 영어 소문자·숫자·밑줄 4~16자. 대문자로 적어도 소문자로 맞춰요 */
export const normalizeId = (s: string) => s.trim().toLowerCase();
export const validId = (s: string) => /^[a-z0-9_]{4,16}$/.test(s);
/** 비밀번호: 8자 이상 */
export const validPassword = (s: string) => s.length >= 8 && s.length <= 128;

export const newSalt = () => b64(rand(16));

export interface Derived {
  /** 서버에 '나 맞아요'를 보여주는 값 */
  auth: string;
  /** 기록 열쇠를 잠그는 열쇠 (폰 안에서만) */
  kek: CryptoKey;
}

export async function deriveKeys(password: string, salt: string, iter = KDF_ITER): Promise<Derived> {
  const base = await crypto.subtle.importKey("raw", te.encode(password.normalize("NFC")), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: unb64(salt), iterations: iter }, base, 256);
  const hk = await crypto.subtle.importKey("raw", bits, "HKDF", false, ["deriveBits", "deriveKey"]);
  const empty = new Uint8Array(0);
  const authBits = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: empty, info: te.encode("geoji-auth") }, hk, 256);
  const kek = await crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: empty, info: te.encode("geoji-kek") },
    hk,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
  return { auth: hex(new Uint8Array(authBits)), kek };
}

async function aesSeal(key: CryptoKey, plain: Uint8Array): Promise<string> {
  const iv = rand(12);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain));
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv);
  out.set(ct, iv.length);
  return b64(out);
}
async function aesOpen(key: CryptoKey, sealed: string): Promise<Uint8Array> {
  const u = unb64(sealed);
  return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: u.slice(0, 12) }, key, u.slice(12)));
}

/** 새 기록 열쇠 (무작위). 폰에 보관하려고 문자열로 돌려줘요 */
export const newDataKey = () => b64(rand(32));
const dataKey = (raw: string) => crypto.subtle.importKey("raw", unb64(raw), { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);

/** 기록 열쇠를 열쇠 상자에 잠그기 / 열기 */
export const wrapDataKey = (dk: string, kek: CryptoKey) => aesSeal(kek, unb64(dk));
export async function unwrapDataKey(wrapped: string, kek: CryptoKey): Promise<string> {
  return b64(await aesOpen(kek, wrapped));
}

/** 기록 잠그기 / 열기 */
export async function seal(data: unknown, dk: string): Promise<string> {
  return aesSeal(await dataKey(dk), te.encode(JSON.stringify(data)));
}
export async function unseal<T = unknown>(blob: string, dk: string): Promise<T> {
  return JSON.parse(td.decode(await aesOpen(await dataKey(dk), blob))) as T;
}
