// 두 기기에서 따로 고친 기록 합치기 (3-way merge)
//
// base   = 마지막으로 서버와 맞췄을 때의 기록 (이 폰에 따로 보관)
// local  = 지금 이 폰 기록
// remote = 지금 서버 기록
// 규칙: 한쪽만 바꿨으면 바뀐 쪽, 둘 다 바꿨으면 안쪽까지 내려가서 다시 비교, 끝까지 겹치면 이 폰 쪽.
//      추가는 양쪽 다 살리고, 지운 건 '다른 쪽이 그대로일 때만' 지워요. (한쪽에서 고쳤으면 고친 걸 살려요)
// 기록이 사라지는 쪽보다 남는 쪽을 골라요.

/* eslint-disable @typescript-eslint/no-explicit-any */
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const isObj = (v: unknown): v is Record<string, any> => !!v && typeof v === "object" && !Array.isArray(v);
const hasIds = (a: unknown[]) => a.length > 0 && a.every((x) => isObj(x) && typeof x.id === "string");

function mergeById(b: any[], l: any[], r: any[]): any[] {
  const bm = new Map(b.filter(isObj).map((x) => [x.id, x]));
  const lm = new Map(l.map((x) => [x.id, x]));
  const rm = new Map(r.map((x) => [x.id, x]));
  const order = [...l.map((x) => x.id), ...r.map((x) => x.id).filter((id) => !lm.has(id))];
  const out: any[] = [];
  for (const id of order) {
    const bi = bm.get(id), li = lm.get(id), ri = rm.get(id);
    if (li && ri) out.push(merge3(bi, li, ri));
    else if (li) {
      // 서버에 없음: 원래 없던 거면 이 폰에서 새로 적은 것, 있었으면 다른 기기에서 지운 것
      if (!bi || !eq(bi, li)) out.push(li);
    } else if (ri) {
      if (!bi || !eq(bi, ri)) out.push(ri);
    }
  }
  return out;
}

function mergeSet(b: any[], l: any[], r: any[]): any[] {
  const key = (x: unknown) => JSON.stringify(x);
  const bs = new Set(b.map(key)), ls = new Set(l.map(key)), rs = new Set(r.map(key));
  const out: any[] = [];
  const seen = new Set<string>();
  for (const x of [...l, ...r]) {
    const k = key(x);
    if (seen.has(k)) continue;
    seen.add(k);
    const removed = bs.has(k) && (!ls.has(k) || !rs.has(k));
    if (!removed) out.push(x);
  }
  return out;
}

export function merge3<T>(base: T | undefined, local: T, remote: T): T {
  if (eq(local, remote)) return local;
  if (base !== undefined && eq(base, local)) return remote;
  if (base !== undefined && eq(base, remote)) return local;
  const b: any = base;
  if (isObj(local) && isObj(remote)) {
    const bo = isObj(b) ? b : {};
    const out: Record<string, any> = {};
    for (const k of new Set([...Object.keys(local), ...Object.keys(remote)])) {
      const inL = k in local, inR = k in remote, inB = k in bo;
      if (inL && inR) out[k] = merge3(bo[k], local[k], remote[k]);
      else if (inL) {
        if (!inB || !eq(bo[k], local[k])) out[k] = local[k];
      } else if (inR) {
        if (!inB || !eq(bo[k], remote[k])) out[k] = remote[k];
      }
    }
    return out as T;
  }
  if (Array.isArray(local) && Array.isArray(remote)) {
    const ba = Array.isArray(b) ? b : [];
    if ((hasIds(local) || local.length === 0) && (hasIds(remote) || remote.length === 0) && (hasIds(local) || hasIds(remote)))
      return mergeById(ba, local, remote) as T;
    if ([...local, ...remote].every((x) => !isObj(x) && !Array.isArray(x))) return mergeSet(ba, local, remote) as T;
  }
  return local;
}
