import { BigWon, SmallIco, TxRow, Won } from "../components/common";
import { Donut } from "../components/Donut";
import { RankCard } from "../components/RankCard";
import { Fragment, useState } from "react";
import { HomeEditor } from "../components/HomeEditor";
import { homeVisible, type HomeBlockId } from "../lib/home";
import { Sheet, SheetHead } from "../components/Sheet";
import { AccountFields, ShareButtons } from "../components/SettlePanel";
import { attendNote, settleMessage, settleMessageFrom } from "../lib/settle";
import { loadAccount } from "../state/account";
import type { Item } from "../lib/types";
import { catVar } from "../lib/cats";
import { dOf, DOW, md, sd } from "../lib/date";
const dayDiffInc = (a: string, b: string) => Math.round((dOf(b).getTime() - dOf(a).getTime()) / 86400000) + 1;
import { flowAmount, flowItems } from "../lib/flow";
import { man, won } from "../lib/format";
import { catShares, getDay, isNoSpend, limitOf, mineOf, owesOf, paidOf, setDay, spentOf, viewItems } from "../lib/ledger";
import { tripSpent } from "../lib/trip";

import { shiftPeriod } from "../lib/period";
import { movedIn, savedTotal, waitLeft } from "../lib/savings";
import { useApp, useModel } from "../state/app";
import { shouldNudge } from "../lib/nudge";
import { Icon } from "../components/common";

const NUDGE_KEY = "ssapgeoji-nudge-snooze";
const readSnooze = () => {
  try {
    return localStorage.getItem(NUDGE_KEY);
  } catch {
    return null;
  }
};

export function HomeView() {
  const { S, today, update, toast, go, openEntry, openDay, toggleNoSpend, account } = useApp();
  const [snoozedOn, setSnoozedOn] = useState(readSnooze);
  const [editing, setEditing] = useState(false);
  const nudge = shouldNudge({ loggedIn: !!account.id, days: S.days, today, snoozedOn });
  const snooze = () => {
    try {
      localStorage.setItem(NUDGE_KEY, today);
    } catch {
      /* 저장이 막혀 있으면 이번에만 닫혀요 */
    }
    setSnoozedOn(today);
  };
  const { cfg, days, weeks, view, cur, isCur, refKey, dayByKey, L, budget } = useModel();
  const D = L; // 생활비 계산용
  const R = S.days; // 실제 기록 (목록·받을 돈·카드)
  const cd = cfg.cycleDay;

  const total = budget;
  const spentAll = days.reduce((s, d) => s + spentOf(D, d.key), 0);
  const left = total - spentAll - movedIn(S.savings.moves, view, cd);
  const ref = dayByKey(refKey)!;
  const wk = weeks.find((w) => w.some((d) => d.key === ref.key))!;
  const owes = owesOf(R);
  const oweSum = owes.reduce((s, { it }) => s + it.amount - mineOf(it), 0);
  const items = getDay(R, ref.key).items;
  const ns = isNoSpend(R, ref.key);
  const trip = ref.trip;
  const tripLeft = trip ? trip.budget - tripSpent(R, trip) : 0;
  const tripDaysLeft = trip ? dayDiffInc(ref.key, trip.end) : 0;

  // 소비 리포트
  const sums: Record<string, number> = {};
  let tot = 0;
  viewItems(D, days).forEach(({ it }) =>
    catShares(it).forEach(({ cat, v }) => {
      sums[cat] = (sums[cat] || 0) + v;
      tot += v;
    }),
  );
  const sorted = Object.keys(sums).filter((k) => sums[k] > 0).sort((a, b) => sums[b] - sums[a]);
  const planned = days.filter((d) => d.key <= refKey).reduce((s, d) => s + limitOf(D, d), 0);
  const spentTo = days.filter((d) => d.key <= refKey).reduce((s, d) => s + spentOf(D, d.key), 0);
  const diff = planned - spentTo;
  let prevLine: string | null = null;
  if (!isCur && view.start < cur.start) {
    const prevP = shiftPeriod(view, -1, cd);
    const prevSpent = Object.keys(D).filter((k) => k >= prevP.start && k <= prevP.end).reduce((s, k) => s + spentOf(D, k), 0);
    if (prevSpent) prevLine = "그 전 달보다 " + won(Math.abs(spentAll - prevSpent)) + (spentAll <= prevSpent ? " 덜 썼어요." : " 더 썼어요.");
  }
  const avail = Math.max(0, savedTotal(D, days, today) - movedIn(S.savings.moves, view, cd));
  const ready = S.wish.items.filter((w) => w.status === "waiting" && !waitLeft(w, Date.now())).length;

  // 신용카드
  const nextCard = flowItems(S, cfg, cur, true).find((it) => it.type === "card" && it.date >= today && it.status !== "skip");

  const [msgFor, setMsgFor] = useState<{ it: Item; key: string } | null>(null);
  const [, bumpAcc] = useState(0);
  const msgText = msgFor?.it.settle?.amounts
    ? settleMessageFrom({
        title: msgFor.it.memo || msgFor.it.cat,
        date: msgFor.key,
        total: msgFor.it.amount,
        rounds: msgFor.it.rounds || [],
        lines: msgFor.it.settle.names.map((n, i) => ({ name: n, amount: msgFor.it.settle!.amounts![i], note: attendNote(msgFor.it.settle!.attend?.[i], (msgFor.it.rounds || []).length) })),
        account: loadAccount(),
      })
    : msgFor
    ? settleMessage({
        title: msgFor.it.memo || msgFor.it.cat,
        date: msgFor.key,
        total: msgFor.it.amount,
        mine: mineOf(msgFor.it),
        people: msgFor.it.settle?.people ?? 2,
        rounds: msgFor.it.rounds || [],
        names: msgFor.it.settle?.names || [],
        attend: msgFor.it.settle?.attend,
        account: loadAccount(),
      })
    : "";

  const received = (key: string, id: string, amount: number) => {
    update((d) => setDay(d.days, key, { items: getDay(d.days, key).items.map((x) => (x.id === id ? { ...x, received: true, receivedOn: today } : x)) }));
    toast(won(amount) + " 받았어요. 생활비 통장 말고 따로 옮겨두세요.");
  };

  const jumpOwe = () => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById("oweCard")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };

  // 홈 카드 (홈 편집에서 순서를 바꾸거나 숨길 수 있어요)
  const blocks: Record<HomeBlockId, JSX.Element> = {
    stats: (
          <div className="stats">
            <div className="stat">
              <span className="k">무지출 챌린지</span>
              <span className="v">{days.filter((d) => isNoSpend(R, d.key)).length + "일"}</span>
            </div>
            <div className="stat">
              <span className="k">예비비</span>
              <Won className="v" n={total - days.reduce((s, d) => s + limitOf(D, d), 0)} />
            </div>
            <button className="stat" onClick={jumpOwe}>
              <span className="k">받을 돈</span>
              <span className="v">{won(oweSum)}</span>
            </button>
          </div>
    ),
    today: (
          <section className="card" aria-label="오늘 내역">
            <div className="card-head">
              <h2>{(ref.key === today ? "오늘 · " : "") + md(ref.date) + " (" + DOW[ref.wd] + ")"}</h2>
              <button className="link" onClick={() => openEntry()}>
                + 추가
              </button>
            </div>
            <ul className="tx">
              {items.map((it) => (
                <TxRow key={it.id} it={it} onClick={() => openDay(ref.key)} />
              ))}
            </ul>
            {items.length === 0 && (
              <div className="empty-box">
                <span>{ns ? "무지출 성공이에요." : "아직 쓴 돈이 없어요."}</span>
                <button className="btn soft" onClick={() => toggleNoSpend(refKey)}>
                  {ns ? "무지출 취소" : ref.key === today ? "오늘은 안 썼어요" : "이날은 안 썼어요"}
                </button>
              </div>
            )}
          </section>
    ),
    rank: <RankCard />,
    report: (
          <section className="card" aria-label="소비 리포트">
            <div className="card-head">
              <h2>소비 리포트</h2>
              <span className="k">내 몫 기준</span>
            </div>
            <div className="report">
              <Donut sorted={sorted} sums={sums} tot={tot} />
              <ul className="legend">
                {!sorted.length && (
                  <li style={{ gridTemplateColumns: "1fr" }}>
                    <span className="k">기록을 남기면 어디에 썼는지 보여드려요.</span>
                  </li>
                )}
                {sorted.slice(0, 6).map((k) => (
                  <li key={k}>
                    <span className="sw" style={{ background: catVar(k) }} />
                    <span className="nm">
                      {k}
                      <small>{Math.round((sums[k] / tot) * 100) + "%"}</small>
                    </span>
                    <b>{won(sums[k])}</b>
                  </li>
                ))}
              </ul>
            </div>
            <div className="insight">
              <span>
                {(isCur ? "오늘까지" : "이 달") + " 계획 " + won(planned) + " 중 "}
                <b className={diff >= 0 ? "plus" : "minus"}>{won(spentTo)}</b> 썼어요.
              </span>
              <span className="k">
                {diff >= 0 ? won(diff) + " 아꼈어요." : "계획보다 " + won(-diff) + " 더 썼어요." + (isCur ? " 남은 날 한도를 조금씩 줄여보세요." : "")}
              </span>
              {sorted.length > 0 && (
                <span className="k">{"가장 많이 쓴 곳은 " + sorted[0] + " (" + Math.round((sums[sorted[0]] / tot) * 100) + "%)이에요."}</span>
              )}
              {prevLine && <span className="k">{prevLine}</span>}
              {avail >= 5000 && (
                <button className="link" style={{ textAlign: "left" }} onClick={() => go("save")}>
                  {"아낀 돈 " + won(avail) + ", 저축통장으로 옮기러 가기 →"}
                </button>
              )}
              {ready > 0 && (
                <button className="link" style={{ textAlign: "left" }} onClick={() => go("save")}>
                  {"기다림이 끝난 물건 " + ready + "개, 아직도 사고 싶은지 확인하기 →"}
                </button>
              )}
            </div>
          </section>
    ),
    card: (
          <section className="card" aria-label="신용카드">
            <div className="card-head">
              <h2>신용카드로 쓴 생활비</h2>
            </div>
            <div className="tiles">
              <div className="tile">
                <span className="k">이 기간 합계</span>
                <span className="v">{won(days.reduce((s, d) => s + paidOf(R, d.key, "card"), 0))}</span>
                <span className="k">친구 몫 포함 결제액</span>
              </div>
              <div className="tile">
                <span className="k">{nextCard ? sd(nextCard.date) + " 카드값 (생활비분)" : "다음 카드값"}</span>
                <span className="v">{nextCard ? won(-flowAmount(nextCard, R)) : "-"}</span>
                <span className="k">
                  {nextCard
                    ? sd(nextCard.cycle!.from) + "~" + sd(nextCard.cycle!.to) + " 사용분"
                    : cfg.cardPay
                      ? "곧 결제할 카드값이 없어요"
                      : "설정에서 결제일을 넣어주세요"}
                </span>
              </div>
            </div>
            <p className="hint">생활비는 체크카드로 쓰면 카드값과 섞이지 않아 관리가 쉬워요.</p>
          </section>
    ),
    owe: (
          <section className="card" id="oweCard" aria-label="친구한테 받을 돈">
            <div className="card-head">
              <h2>친구한테 받을 돈</h2>
              <span className="head-r">
                <b>{won(oweSum)}</b>
                <button className="link" onClick={() => go("settle")}>
                  정산하기
                </button>
              </span>
            </div>
            <ul className="tx">
              {owes.map(({ it, key }) => (
                <li key={it.id}>
                  <SmallIco text={sd(key)} bg="var(--warn-soft)" fg="var(--warn)" />
                  <span className="t">
                    <b>{it.memo || it.cat || "대신 낸 돈"}</b>
                    <span>{"총 " + won(it.amount) + " 중 내 몫 " + won(mineOf(it))}</span>
                  </span>
                  <span className="a">
                    <b>{won(it.amount - mineOf(it))}</b>
                    <span className="mini-btns">
                    <button className="btn line" style={{ padding: "5px 10px", fontSize: "12.5px" }} aria-label={(it.memo || "대신 낸 돈") + " 정산 메시지"} onClick={() => setMsgFor({ it, key })}>
                      메시지
                    </button>
                    <button
                      className="btn soft"
                      style={{ padding: "5px 10px", fontSize: "12.5px" }}
                      aria-label={(it.memo || "대신 낸 돈") + " " + won(it.amount - mineOf(it)) + " 받았어요"}
                      onClick={() => received(key, it.id, it.amount - mineOf(it))}
                    >
                      받았어요
                    </button>
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            {owes.length === 0 && <p className="hint">대신 낸 돈이 없어요. 먼저 결제했다면 자리 뜨기 전에 송금 요청부터 보내세요.</p>}
          </section>
    ),
  };

  return (
    <div className="view home2">
      <section className="hero" aria-label="생활비 요약">
        <div>
          <div className="eyebrow">{(isCur ? "이번 달" : sd(view.start) + "~" + sd(view.end)) + " 생활비 " + man(total) + "원 중 남은 돈"}</div>
          <div className={"big" + (left < 0 ? " minus" : "")}>
            <BigWon n={left} />
          </div>
        </div>
        <div className="track">
          <i style={{ width: Math.min(100, total ? (spentAll / total) * 100 : 0) + "%" }} />
        </div>
        <div className="hero-row">
          <div>
            <div className="k">{trip ? trip.name + " 남은 돈 · " + tripDaysLeft + "일 남음" : (ref.key === today ? "오늘" : md(ref.date)) + " 쓸 수 있는 돈"}</div>
            <div className="v">{won(trip ? tripLeft : limitOf(D, ref) - spentOf(D, ref.key))}</div>
          </div>
          <div>
            <div className="k">이번 주 남은 돈</div>
            <div className="v">{won(wk.reduce((s, d) => s + limitOf(D, d) - spentOf(D, d.key), 0))}</div>
          </div>
        </div>
      </section>

      {!cfg.total && !Object.values(R).some((x) => x?.items?.length) && (
        <section className="card restore" aria-label="전에 쓰던 기록">
          <h2>전에 쓰던 기록이 있나요?</h2>
          <p className="hint">
            기록은 연 곳마다 따로 저장돼요. Safari와 홈 화면 아이콘, 카카오톡 안 화면은 서로 기록을 못 봐요. 쓰던 곳에서 백업 파일을 저장한 뒤 여기서 불러오세요.
          </p>
          <button className="btn line" onClick={() => go("setup/data")}>
            백업 불러오러 가기
          </button>
        </section>
      )}

      {nudge > 0 && (
        <section className="card nudge" aria-label="기록 보관">
          <div className="nudge-h">
            <i className="acct-ri">{Icon.shield}</i>
            <span>
              <b>{"기록 " + nudge + "건, 이 폰에만 있어요"}</b>
              <span>브라우저 기록을 지우거나 폰을 바꾸면 사라질 수 있어요. 30초면 잠가서 보관해요.</span>
            </span>
          </div>
          <div className="nudge-b">
            <button className="btn gray" onClick={snooze}>
              다음에
            </button>
            <button className="btn" onClick={() => go("setup/account")}>
              보관하기
            </button>
          </div>
        </section>
      )}

      {homeVisible(cfg.homeOrder, cfg.homeHidden).map((id) => (
        <Fragment key={id}>{blocks[id]}</Fragment>
      ))}

      <button className="link home-edit" onClick={() => setEditing(true)}>
        홈 편집
      </button>
      <HomeEditor open={editing} onClose={() => setEditing(false)} />

      <Sheet open={!!msgFor} onClose={() => setMsgFor(null)} labelledBy="msgTitle">
        <SheetHead id="msgTitle" title="정산 메시지" onClose={() => setMsgFor(null)} />
        <pre className="settle-preview">{msgText}</pre>
        <ShareButtons text={msgText} />
        <details className="settle-acc">
          <summary>내 계좌 바꾸기</summary>
          <AccountFields idp="hm" onChange={() => bumpAcc((x) => x + 1)} />
        </details>
      </Sheet>
    </div>
  );
}
