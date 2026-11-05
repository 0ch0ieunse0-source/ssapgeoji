import { catVar } from "../lib/cats";
import { short } from "../lib/format";

/** 분류별 소비 도넛 (sorted: 큰 순서 분류 이름, sums: 분류별 금액, tot: 합계) */
export function Donut({ sorted, sums, tot }: { sorted: string[]; sums: Record<string, number>; tot: number }) {
  const R = 46, C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <svg className="donut" viewBox="0 0 120 120" role="img" aria-label="분류별 소비 비율">
      <circle cx="60" cy="60" r={R} fill="none" style={{ stroke: "var(--surface-2)" }} strokeWidth="16" />
      {sorted.map((k) => {
        const len = (sums[k] / tot) * C;
        const off = -acc;
        acc += len;
        return (
          <circle
            key={k}
            cx="60"
            cy="60"
            r={R}
            fill="none"
            style={{ stroke: catVar(k) }}
            strokeWidth="16"
            strokeDasharray={len.toFixed(2) + " " + (C - len).toFixed(2)}
            strokeDashoffset={off.toFixed(2)}
            transform="rotate(-90 60 60)"
          />
        );
      })}
      <text x="60" y="55" textAnchor="middle" fontSize="10" style={{ fill: "var(--muted)" }}>
        쓴 돈
      </text>
      <text x="60" y="72" textAnchor="middle" fontSize="15" fontWeight="700" style={{ fill: "var(--ink)" }}>
        {short(tot) + (tot >= 10000 ? "" : "원")}
      </text>
    </svg>
  );
}
