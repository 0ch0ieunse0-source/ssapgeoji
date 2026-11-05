import { dOf, kOf, sd } from "../lib/date";
import { man } from "../lib/format";
import { snapValue, type computeGoal } from "../lib/goal";

/** 자산 기록(점·선)과 목표 경로(점선) 그래프 */
export function GoalChart({ g, goalDate }: { g: ReturnType<typeof computeGoal>; goalDate: string }) {
  const { goal: GOAL, t0, t1, startVal, snaps, base, goalEnd } = g;
  const W = 320, H = 170, L = 40, Rr = 10, T = 10, B = 24;
  const span = Math.max(1, t1 - t0);
  const x = (t: number) => L + Math.max(0, Math.min(1, (t - t0) / span)) * (W - L - Rr);
  const y = (v: number) => T + (1 - Math.min(Math.max(v, 0), GOAL) / GOAL) * (H - T - B);
  const muted = { fill: "var(--muted)" };
  const ys = new Date(t0).getFullYear(), ye = goalEnd.getFullYear();
  const years: number[] = [];
  for (let yr = ys + 1; yr <= ye; yr++) years.push(yr);
  const pts: [number, number][] = snaps.length ? snaps.map((s) => [dOf(s.date).getTime(), snapValue(s)]) : [[t0, base]];
  return (
    <svg className="chart" viewBox="0 0 320 170" role="img" aria-label="자산 기록과 목표 경로">
      {[0, GOAL / 3, (GOAL * 2) / 3, GOAL].map((v, i) => (
        <g key={i}>
          <line x1={L} x2={W - Rr} y1={y(v)} y2={y(v)} style={{ stroke: "var(--line)" }} strokeWidth="1" />
          <text x={L - 6} y={y(v) + 3.5} textAnchor="end" fontSize="10" style={muted}>
            {man(v)}
          </text>
        </g>
      ))}
      {ye > ys ? (
        years.map((yr) => (
          <text key={yr} x={x(new Date(yr, 0, 1).getTime())} y={H - 6} textAnchor="middle" fontSize="10" style={muted}>
            {yr}
          </text>
        ))
      ) : (
        <>
          <text x={L} y={H - 6} textAnchor="start" fontSize="10" style={muted}>
            {sd(kOf(new Date(t0)))}
          </text>
          <text x={W - Rr} y={H - 6} textAnchor="end" fontSize="10" style={muted}>
            {sd(goalDate)}
          </text>
        </>
      )}
      <line x1={x(t0)} y1={y(startVal)} x2={x(t1)} y2={y(GOAL)} style={{ stroke: "var(--muted)" }} strokeWidth="1.5" strokeDasharray="4 4" />
      <text x={W - Rr} y={y(GOAL) + 14} textAnchor="end" fontSize="10" style={muted}>
        목표 경로
      </text>
      {pts.length > 1 && (
        <polyline
          fill="none"
          style={{ stroke: "var(--accent)" }}
          strokeWidth="2.5"
          strokeLinejoin="round"
          points={pts.map((p) => x(p[0]).toFixed(1) + "," + y(p[1]).toFixed(1)).join(" ")}
        />
      )}
      {pts.map((p, i) => (
        <circle
          key={i}
          cx={x(p[0]).toFixed(1)}
          cy={y(p[1]).toFixed(1)}
          r={i === pts.length - 1 ? 4.5 : 3}
          style={{ fill: "var(--accent)", stroke: "var(--surface)" }}
          strokeWidth="1.5"
        />
      ))}
    </svg>
  );
}
