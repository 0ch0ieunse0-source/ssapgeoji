import { useEffect } from "react";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { applyAccent } from "./lib/theme";
import { Onboarding } from "./components/Onboarding";
import { WhatsNew } from "./components/WhatsNew";
import { UpdateToast } from "./components/UpdateToast";
import { BANK_ROUTES, BankTabs, Banner, Dock, PeriodNav, Toast, TopBar } from "./components/Shell";
import { SpaceView } from "./views/SpaceView";
import { DaySheet } from "./sheets/DaySheet";
import { ApptSheet } from "./sheets/ApptSheet";
import { EntrySheet } from "./sheets/EntrySheet";
import { AppProvider, useApp } from "./state/app";
import { FlowView } from "./views/FlowView";
import { GoalView } from "./views/GoalView";
import { HomeView } from "./views/HomeView";
import { LedgerView } from "./views/LedgerView";
import { NoticeView } from "./views/NoticeView";
import { RankView } from "./views/RankView";
import { SettleView } from "./views/SettleView";
import { SaveView } from "./views/SaveView";
import { SetupView } from "./views/SetupView";

const TAB_ROUTES: string[] = ["home", "ledger", "save", "flow", "goal", "space"];

function Shell() {
  const { model, route, sub, entry, dayKey, formNonce, appt, openAppt } = useApp();
  const accent = model?.cfg.accent;
  useEffect(() => applyAccent(accent), [accent]);
  const sheetOpen = entry.open || !!dayKey;
  useEffect(() => {
    document.body.style.overflow = sheetOpen ? "hidden" : "";
  }, [sheetOpen]);

  return (
    <>
      <div className="app">
        {/* 탭 화면에서만 앱 이름 헤더. 그 밖의 페이지는 각자 '뒤로가기 + 페이지 이름' 헤더를 써요 */}
        {(!model || (TAB_ROUTES.includes(route) && !(route === "space" && sub))) && <TopBar />}
        {model && BANK_ROUTES.includes(route) && <BankTabs />}
        <Banner />
        {model && (route === "home" || route === "ledger" || route === "save") && <PeriodNav />}
        <main style={{ display: "contents" }}>
          {/* 화면 하나에 오류가 나도 아래 탭으로 다른 화면에 갈 수 있게, 화면마다 따로 감싸요 */}
          <ErrorBoundary key={route + "/" + sub}>
          {route === "setup" && <SetupView key={(model ? "edit" : "new") + formNonce + sub} section={sub} />}
          {model && route === "home" && <HomeView />}
          {model && route === "ledger" && <LedgerView />}
          {model && route === "save" && <SaveView />}
          {model && route === "flow" && <FlowView />}
          {model && route === "goal" && <GoalView />}
          {model && route === "notice" && <NoticeView key={sub} id={sub} />}
          {model && route === "rank" && <RankView key={sub} sub={sub} />}
          {model && route === "settle" && <SettleView />}
          {model && route === "space" && <SpaceView key={sub} sub={sub} />}
          </ErrorBoundary>
        </main>
        {!model && <footer>기록은 이 기기의 브라우저에만 저장되고 다른 사람은 볼 수 없어요. 설정에서 백업 파일을 저장해 두면 다른 기기로 옮길 수 있어요.</footer>}
      </div>
      {model && !(route === "setup" && sub === "account") && <Dock />}
      <DaySheet />
      {model && <ApptSheet target={appt} onClose={() => openAppt(null)} />}
      <EntrySheet />
      <Onboarding />
      <UpdateToast />
      <WhatsNew />
      <Toast />
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
