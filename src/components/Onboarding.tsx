import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { detectBrowser, IN_APP_NAME, kakaoExternal, type BrowserEnv } from "../lib/browser";
import { useApp } from "../state/app";
import { Icon } from "./common";
import { AndroidSteps, InAppSteps, IosOtherSteps, IosSteps } from "./InstallSteps";

const MASCOT = import.meta.env.BASE_URL + "mascot.png";

interface Slide {
  art: ReactNode;
  title: string;
  body: ReactNode;
}

const art = (icon: ReactNode) => (
  <div className="onb-ico" aria-hidden="true">
    {icon}
  </div>
);

const SLIDES: Slide[] = [
  {
    art: (
      <div className="onb-mascot">
        <img src={MASCOT} alt="" width={240} height={197} />
      </div>
    ),
    title: "거지노트에 오신 걸 환영해요",
    body: "한 달 생활비를 하루 단위로 나눠서 지키는 가계부예요. 주요 기능을 짧게 보여드릴게요.",
  },
  {
    art: art(Icon.home),
    title: "생활비만 넣으면 하루 한도가 생겨요",
    body: "평일·주말·약속 날에 맞춰 하루 한도를 자동으로 나눠요. 홈에서 오늘 쓸 수 있는 돈과 이번 주 남은 돈을 바로 볼 수 있어요.",
  },
  {
    art: art(Icon.plus),
    title: "쓴 돈은 바로바로 적어요",
    body: "아래 '쓴 돈 적기' 버튼으로 금액과 분류를 적어요. 친구 몫까지 먼저 냈다면 나눠 적고, 받을 돈으로 따로 챙겨요.",
  },
  {
    art: art(Icon.save),
    title: "아낀 돈은 모으고, 큰돈은 미리 봐요",
    body: "한도보다 덜 쓴 돈은 저축통장으로 옮기고, 사고 싶은 건 대기 목록에 넣어 하루나 3일 기다려요. 돈 일정에서는 월급·고정지출·카드값으로 통장 잔액을 미리 봐요.",
  },
  {
    art: art(Icon.goal),
    title: "기록은 이 폰에만 저장돼요",
    body: "로그인도 서버도 없어서 다른 사람은 내 기록을 볼 수 없어요. 대신 폰을 바꾸기 전에는 설정에서 백업 파일을 저장해 두세요.",
  },
];

function SafariGuide({ env, onCopy }: { env: BrowserEnv; onCopy: () => void }) {
  const browser = env.os === "android" ? "Chrome" : "Safari";
  if (env.inApp) return <InAppSteps app={IN_APP_NAME[env.inApp]} browser={browser} kakao={env.inApp === "kakao"} onCopy={onCopy} isIos={env.os !== "android"} />;
  if (env.standalone) return <p className="hint">홈 화면 아이콘으로 잘 열었어요. 앞으로도 이 아이콘으로 열어 주세요.</p>;
  if (env.os === "ios" && !env.safari) return <IosOtherSteps onCopy={onCopy} />;
  if (env.os === "ios")
    return (
      <>
        <IosSteps />
        <p className="hint warn-note">Safari와 홈 화면 아이콘은 기록을 따로 저장해요. Safari에서 이미 기록했다면, 추가하기 전에 <b>설정 → 기록 보관 → 백업 파일 저장</b>부터 하고 아이콘에서 불러오세요.</p>
      </>
    );
  if (env.os === "android") return <AndroidSteps />;
  return (
    <>
      <p className="hint">폰에서 이 링크를 열어 주세요. 아이폰은 Safari, 안드로이드는 Chrome으로 열고 홈 화면에 추가하면 앱처럼 쓸 수 있어요.</p>
      <button className="btn line" onClick={onCopy}>
        링크 복사
      </button>
      <p className="hint vthen">아이폰 Safari에서는 이렇게 해요</p>
      <IosSteps />
    </>
  );
}

/** 처음 열 때 보여주는 사용법과 Safari 안내. 다른 앱 안에서 열리면 Safari 안내를 매번 보여줘요. */
export function Onboarding() {
  const { guide, closeGuide, markGuideSeen, toast } = useApp();
  const env = useMemo(
    () =>
      detectBrowser(
        navigator.userAgent,
        navigator.maxTouchPoints > 1,
        window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true,
      ),
    [],
  );
  const total = SLIDES.length + 1;
  const [i, setI] = useState(0);
  const headRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (guide.open) setI(guide.safariOnly ? SLIDES.length : 0);
  }, [guide.open, guide.safariOnly]);
  useEffect(() => {
    if (guide.open) headRef.current?.focus();
  }, [guide.open, i]);
  useEffect(() => {
    // 마지막 장(Safari 안내)에 닿으면 튜토리얼을 끝낸 걸로 저장해요. 시작하기를 안 누르고 나가도 다시 안 떠요.
    if (guide.open && i === SLIDES.length) markGuideSeen();
  }, [guide.open, i, markGuideSeen]);
  useEffect(() => {
    if (!guide.open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [guide.open]);

  if (!guide.open) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(location.href.split("#")[0]);
      toast("링크를 복사했어요. " + (env.os === "android" ? "Chrome" : "Safari") + " 주소창에 붙여 넣어 주세요.");
    } catch {
      toast("복사하지 못했어요. 주소창의 링크를 길게 눌러 복사해 주세요.", true);
    }
  };

  const last = i === SLIDES.length;
  const browser = env.os === "android" ? "Chrome" : "Safari";
  const slide = last
    ? {
        art: (
          <div className="onb-mascot">
            <img src={MASCOT} alt="" width={240} height={197} />
          </div>
        ),
        title: env.inApp || (env.os === "ios" && !env.safari) ? browser + "에서 열어 주세요" : env.standalone ? "준비 끝!" : "홈 화면에 추가해서 써요",
        body: null,
      }
    : SLIDES[i];

  return (
    <div className="onb" role="dialog" aria-modal="true" aria-labelledby="onbTitle">
      <div className="onb-in">
        <div className="onb-top">
          <span className="k" aria-live="polite">
            {guide.safariOnly ? "" : i + 1 + " / " + total}
          </span>
          {!last && (
            <button className="link" onClick={() => setI(SLIDES.length)}>
              건너뛰기
            </button>
          )}
        </div>
        <div className={"onb-art" + (last ? " small" : "")}>{slide.art}</div>
        <div className="onb-text">
          <h2 id="onbTitle" ref={headRef} tabIndex={-1}>
            {slide.title}
          </h2>
          {last ? <SafariGuide env={env} onCopy={copy} /> : <p>{slide.body}</p>}
        </div>
        {!guide.safariOnly && (
          <div className="onb-dots" aria-hidden="true">
            {Array.from({ length: total }, (_, k) => (
              <i key={k} className={k === i ? "on" : undefined} />
            ))}
          </div>
        )}
        <div className={"onb-actions" + (i > 0 && !last ? " two" : "")}>
          {i > 0 && !last && (
            <button className="btn line" onClick={() => setI(i - 1)}>
              이전
            </button>
          )}
          {!last && (
            <button className="btn" onClick={() => setI(i + 1)}>
              다음
            </button>
          )}
          {last && env.inApp === "kakao" && (
            <a className="btn onb-a" href={kakaoExternal(location.href.split("#")[0])}>
              {browser + "로 열기"}
            </a>
          )}
          {last && (
            <button className={env.inApp ? "btn line" : "btn"} onClick={closeGuide}>
              {env.inApp ? "그래도 여기서 볼게요" : guide.safariOnly ? "확인" : "시작하기"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
