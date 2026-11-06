import { FE } from "../assets/fluentEmoji";
import { ROOM_TIERS } from "../lib/space";

const MASCOT = import.meta.env.BASE_URL + "mascot.png";

/** Fluent Emoji 하나를 (x, y)에 s 크기로 */
function E({ n, x, y, s, r = 0, o = 1 }: { n: string; x: number; y: number; s: number; r?: number; o?: number }) {
  const body = FE[n];
  if (!body) return null;
  return (
    <g transform={r ? `rotate(${r} ${x + s / 2} ${y + s / 2})` : undefined} opacity={o}>
      <svg x={x} y={y} width={s} height={s} viewBox="0 0 32 32" dangerouslySetInnerHTML={{ __html: body }} />
    </g>
  );
}

const Mascot = ({ x = 108, y = 78, w = 104, dim = false }: { x?: number; y?: number; w?: number; dim?: boolean }) => (
  <image href={MASCOT} x={x} y={y} width={w} height={(w * 197) / 240} style={dim ? { filter: "grayscale(.35) brightness(.92)" } : undefined} />
);

/** 받은 동전 수에 따라 꼬질한 길바닥 → 귀티 나는 펜트하우스. 배경·집·카펫은 직접 그리고, 소품은 Fluent Emoji(MIT)예요 */
export function RoomScene({ tier, className }: { tier: number; className?: string }) {
  const t = Math.max(0, Math.min(4, tier));
  return (
    <svg className={"room " + (className || "")} viewBox="0 0 320 200" role="img" aria-label={ROOM_TIERS[t].name}>
      {t === 0 && (
        <>
          {/* 길바닥: 회색 벽돌 골목, 아스팔트, 날파리 */}
          <rect width="320" height="200" fill="#7b8088" />
          {Array.from({ length: 7 }, (_, row) =>
            Array.from({ length: 9 }, (_, col) => (
              <rect key={row + "-" + col} x={col * 40 - (row % 2) * 20} y={row * 22} width="38" height="20" rx="1.5" fill={(row + col) % 3 ? "#6c7178" : "#666b72"} />
            )),
          )}
          <rect y="150" width="320" height="50" fill="#45484d" />
          <path d="M0 150h320" stroke="#3a3c40" strokeWidth="3" />
          <path d="M30 178h40M120 188h30M230 176h50" stroke="#55585e" strokeWidth="2" strokeLinecap="round" />
          <E n="spider-web" x={-4} y={-4} s={58} o={0.85} />
          <E n="newspaper" x={98} y={138} s={124} r={-4} />
          <Mascot y={84} dim />
          <E n="canned-food" x={232} y={142} s={36} r={18} />
          <E n="fly" x={76} y={62} s={18} />
          <E n="fly" x={226} y={96} s={14} r={-20} />
          <E n="cockroach" x={30} y={164} s={20} r={-30} />
          <rect width="320" height="200" fill="#20242a" opacity="0.12" />
        </>
      )}
      {t === 1 && (
        <>
          {/* 골판지 하우스: 박스 집, 촛불 */}
          <rect width="320" height="200" fill="#5c6470" />
          <rect y="152" width="320" height="48" fill="#4b4f55" />
          <path d="M52 152V70l108-34 108 34v82z" fill="#c99a5b" />
          <path d="M52 70l108-34 108 34-12 10-96-30-96 30z" fill="#b5844a" />
          <path d="M160 36v116" stroke="#a87943" strokeWidth="3" />
          <path d="M70 100h40M210 112h40M76 128h28" stroke="#a87943" strokeWidth="2.5" strokeLinecap="round" />
          <rect x="196" y="84" width="34" height="14" rx="2" fill="#f4e6c8" transform="rotate(-4 213 91)" />
          <text x="213" y="95" fontSize="9" fontWeight="700" fill="#7a5530" textAnchor="middle" transform="rotate(-4 213 91)">
            FRAGILE
          </text>
          <Mascot y={86} />
          <E n="candle" x={64} y={120} s={32} />
          <E n="canned-food" x={224} y={128} s={30} />
          <E n="coin" x={232} y={116} s={14} />
          <E n="broom" x={276} y={104} s={46} r={10} />
          <E n="package" x={18} y={134} s={30} />
        </>
      )}
      {t === 2 && (
        <>
          {/* 반지하 단칸방: 높은 작은 창, 라면, 돼지 저금통 */}
          <rect width="320" height="200" fill="#cbc2b3" />
          <rect y="0" width="320" height="10" fill="#b9af9e" />
          <rect x="196" y="12" width="78" height="34" rx="3" fill="#8fb3c9" stroke="#8a7f6d" strokeWidth="4" />
          <path d="M235 12v34" stroke="#8a7f6d" strokeWidth="3" />
          <rect x="200" y="34" width="70" height="10" fill="#6d7b52" opacity=".6" />
          <path d="M150 0v28" stroke="#5d5548" strokeWidth="2" />
          <E n="light-bulb" x={136} y={24} s={28} />
          <rect y="150" width="320" height="50" fill="#8a7a66" />
          <path d="M0 150h320" stroke="#76685a" strokeWidth="3" />
          <rect x="20" y="132" width="70" height="20" rx="3" fill="#a08d75" />
          <Mascot y={86} />
          <E n="steaming-bowl" x={34} y={104} s={36} />
          <E n="pig-face" x={238} y={130} s={36} />
          <E n="coin" x={270} y={150} s={14} />
          <E n="bucket" x={282} y={120} s={30} />
        </>
      )}
      {t === 3 && (
        <>
          {/* 원룸: 침대, 화분, 액자 */}
          <rect width="320" height="200" fill="#f3ead8" />
          <rect y="112" width="320" height="40" fill="#e7dcc5" />
          <path d="M0 112h320" stroke="#d8cbb0" strokeWidth="3" />
          <rect y="150" width="320" height="50" fill="#d6b37f" />
          {Array.from({ length: 8 }, (_, i) => (
            <path key={i} d={`M${i * 44} 150v50`} stroke="#c8a26c" strokeWidth="2" />
          ))}
          <E n="framed-picture" x={36} y={20} s={52} />
          <E n="bed" x={186} y={78} s={118} />
          <E n="potted-plant" x={8} y={96} s={62} />
          <Mascot x={92} y={86} />
          <E n="teacup-without-handle" x={158} y={150} s={24} />
          <E n="pig-face" x={240} y={34} s={28} />
        </>
      )}
      {t === 4 && (
        <>
          {/* 거지 펜트하우스: 금테 벽, 레드카펫, 왕관 */}
          <defs>
            <linearGradient id="phWall" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#3b2a5c" />
              <stop offset="1" stopColor="#5b3f8a" />
            </linearGradient>
          </defs>
          <rect width="320" height="200" fill="url(#phWall)" />
          <rect x="10" y="10" width="300" height="134" rx="6" fill="none" stroke="#e8c15a" strokeWidth="3" />
          <rect x="18" y="18" width="284" height="118" rx="4" fill="none" stroke="#e8c15a" strokeWidth="1" opacity=".6" />
          <rect y="146" width="320" height="54" fill="#2b2140" />
          <path d="M112 146h96l40 54H72z" fill="#c8263f" />
          <path d="M112 146h96l40 54H72z" fill="none" stroke="#e8c15a" strokeWidth="2" />
          <E n="red-paper-lantern" x={70} y={14} s={32} />
          <E n="red-paper-lantern" x={218} y={14} s={32} />
          <E n="sparkles" x={150} y={14} s={22} />
          <E n="money-bag" x={22} y={110} s={52} />
          <E n="trophy" x={262} y={96} s={40} />
          <E n="gem-stone" x={250} y={150} s={30} />
          <Mascot y={84} />
          <E n="crown" x={140} y={56} s={40} />
          <E n="dollar-banknote" x={78} y={164} s={26} r={-20} />
          <E n="dollar-banknote" x={212} y={168} s={24} r={25} />
          <E n="coin" x={60} y={150} s={16} />
          <E n="coin" x={242} y={134} s={14} />
        </>
      )}
    </svg>
  );
}
