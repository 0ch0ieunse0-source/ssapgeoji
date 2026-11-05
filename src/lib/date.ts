import type { Key } from "./types";

export const DOW = ["일", "월", "화", "수", "목", "금", "토"];

/** Date → "YYYY-MM-DD" (기기 시간대 기준) */
export const kOf = (d: Date): Key =>
  d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");

/** "YYYY-MM-DD" → 그날 0시 Date */
export const dOf = (k: Key): Date => {
  const [y, m, dd] = k.split("-").map(Number);
  return new Date(y, m - 1, dd);
};

export const addDays = (k: Key, n: number): Key => {
  const d = dOf(k);
  d.setDate(d.getDate() + n);
  return kOf(d);
};

/** y년 m월(0부터)의 day일. 그 달에 없는 날이면 마지막 날로 맞춰요. m이 -1이나 12여도 돼요. */
export const dateFor = (y: number, m: number, day: number): Key =>
  kOf(new Date(y, m, Math.min(day, new Date(y, m + 1, 0).getDate())));

export const md = (d: Date) => d.getMonth() + 1 + "월 " + d.getDate() + "일";
export const sd = (k: Key) => {
  const d = dOf(k);
  return d.getMonth() + 1 + "/" + d.getDate();
};

export const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};
