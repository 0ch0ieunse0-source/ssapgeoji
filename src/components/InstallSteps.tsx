import type { ReactNode } from "react";

/** Safari·Chrome에서 홈 화면에 추가하는 법을 그림과 함께 한 단계씩 */
const ICON = import.meta.env.BASE_URL + "icons/icon-192.png?v=2";
const s = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;
const ShareIco = () => (
  <svg {...s}>
    <path d="M12 3v12M8 7l4-4 4 4" />
    <path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />
  </svg>
);
const PlusBox = () => (
  <svg {...s}>
    <rect x="4" y="4" width="16" height="16" rx="4" />
    <path d="M12 8v8M8 12h8" />
  </svg>
);

/** pic: 설명용 그림 (화면 읽기 프로그램은 건너뛰어요), note: 읽어야 하는 설명·버튼 */
function Step({ n, title, pic, note }: { n: number; title: ReactNode; pic?: ReactNode; note?: ReactNode }) {
  return (
    <li className="vstep">
      <span className="vnum" aria-hidden="true">
        {n}
      </span>
      <div className="vbody">
        <b>{title}</b>
        {pic && (
          <div className="vpic" aria-hidden="true">
            {pic}
          </div>
        )}
        {note}
      </div>
    </li>
  );
}

const HomeTile = () => (
  <div className="m-home">
    <span className="m-app">
      <img src={ICON} alt="" width={44} height={44} />
      <span>거지노트</span>
    </span>
  </div>
);

/** 아이폰 Safari */
export function IosSteps({ from = 1 }: { from?: number }) {
  return (
    <ol className="vsteps">
      <Step
        n={from}
        title="화면 아래 가운데 공유 버튼을 눌러요"
        note={<small>공유 버튼이 안 보이면 주소창 옆 ··· 를 누르고 '공유'를 눌러요.</small>}
        pic={
        <div className="m-bar">
          <span>‹</span>
          <span>›</span>
          <span className="hit">
            <ShareIco />
          </span>
          <span>▢</span>
          <span>⧉</span>
        </div>
        }
      />
      <Step
        n={from + 1}
        title="'홈 화면에 추가'를 눌러요"
        note={<small>안 보이면 목록을 아래로 내려 보세요.</small>}
        pic={
          <div className="m-sheet">
            <span>복사</span>
            <span>읽기 목록에 추가</span>
            <span className="hit">
              홈 화면에 추가 <PlusBox />
            </span>
          </div>
        }
      />
      <Step
        n={from + 2}
        title="오른쪽 위 '추가'를 눌러요"
        pic={
          <div className="m-top">
            <span>취소</span>
            <b>홈 화면에 추가</b>
            <span className="hit">추가</span>
          </div>
        }
      />
      <Step n={from + 3} title="홈 화면의 거지노트 아이콘으로 열어요" pic={<HomeTile />} />
    </ol>
  );
}

/** 안드로이드 Chrome */
export function AndroidSteps({ from = 1 }: { from?: number }) {
  return (
    <ol className="vsteps">
      <Step
        n={from}
        title="오른쪽 위 ⋮ 메뉴를 눌러요"
        pic={
          <div className="m-bar url">
            <span className="m-url">0ch0ieunse0-source.github.io</span>
            <span className="hit">⋮</span>
          </div>
        }
      />
      <Step
        n={from + 1}
        title="'홈 화면에 추가' 또는 '앱 설치'를 눌러요"
        pic={
          <div className="m-sheet">
            <span>새 탭</span>
            <span>북마크</span>
            <span className="hit">
              홈 화면에 추가 <PlusBox />
            </span>
          </div>
        }
      />
      <Step n={from + 2} title="'추가'(또는 '설치')를 누르고, 홈 화면 아이콘으로 열어요" pic={<HomeTile />} />
    </ol>
  );
}

/** 카카오톡 같은 앱 안에서 열렸을 때 */
export function InAppSteps({ app, browser, kakao, onCopy, isIos }: { app: string; browser: string; kakao: boolean; onCopy: () => void; isIos: boolean }) {
  return (
    <>
      <div className="alert bad" role="alert">
        {"지금 " + app + " 안에서 열려 있어요. 여기서 적은 기록은 앱을 닫거나 업데이트할 때 사라질 수 있어요."}
      </div>
      <ol className="vsteps">
        {kakao ? (
          <Step n={1} title={"아래 '" + browser + "로 열기' 버튼을 눌러요"} />
        ) : (
          <Step
            n={1}
            title={"화면 구석 ··· 메뉴에서 '" + browser + "로 열기'를 눌러요"}
            note={
              <small>
                메뉴가 없으면 링크를 복사해서 {browser} 주소창에 붙여 넣어요.{" "}
                <button className="link" onClick={onCopy}>
                  링크 복사
                </button>
              </small>
            }
          />
        )}
      </ol>
      <p className="hint vthen">{browser + "에서 열리면 이렇게 홈 화면에 추가해요"}</p>
      {isIos ? <IosSteps from={2} /> : <AndroidSteps from={2} />}
    </>
  );
}

/** 아이폰인데 Safari가 아닐 때 (Chrome 등) */
export function IosOtherSteps({ onCopy }: { onCopy: () => void }) {
  return (
    <>
      <div className="alert bad">아이폰에서는 Safari로 열어야 홈 화면에 추가하고 기록을 오래 지킬 수 있어요.</div>
      <ol className="vsteps">
        <Step
          n={1}
          title="링크를 복사해요"
          note={
            <button className="btn soft vcopy" onClick={onCopy}>
              링크 복사
            </button>
          }
        />
        <Step n={2} title="Safari를 열고 주소창에 붙여 넣어요" />
      </ol>
      <p className="hint vthen">Safari에서 열리면 이렇게 홈 화면에 추가해요</p>
      <IosSteps from={3} />
    </>
  );
}
