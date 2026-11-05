import { useEffect } from "react";
import { Onboarding } from "./components/Onboarding";
import { Banner, Dock, PeriodNav, Toast, TopBar } from "./components/Shell";
import { DaySheet } from "./sheets/DaySheet";
import { EntrySheet } from "./sheets/EntrySheet";
import { AppProvider, useApp } from "./state/app";
import { FlowView } from "./views/FlowView";
import { GoalView } from "./views/GoalView";
import { HomeView } from "./views/HomeView";
import { LedgerView } from "./views/LedgerView";
import { NoticeView } from "./views/NoticeView";
import { SaveView } from "./views/SaveView";
import { SetupView } from "./views/SetupView";

function Shell() {
  const { model, route, entry, dayKey, formNonce } = useApp();
  const sheetOpen = entry.open || !!dayKey;
  useEffect(() => {
    document.body.style.overflow = sheetOpen ? "hidden" : "";
  }, [sheetOpen]);

  return (
    <>
      <div className="app">
        {route !== "notice" && <TopBar />}
        <Banner />
        {model && (route === "home" || route === "ledger" || route === "save") && <PeriodNav />}
        <main style={{ display: "contents" }}>
          {route === "setup" && <SetupView key={(model ? "edit" : "new") + formNonce} />}
          {model && route === "home" && <HomeView />}
          {model && route === "ledger" && <LedgerView />}
          {model && route === "save" && <SaveView />}
          {model && route === "flow" && <FlowView />}
          {model && route === "goal" && <GoalView />}
          {model && route === "notice" && <NoticeView />}
        </main>
        <footer>기록은 이 기기의 브라우저에만 저장되고 다른 사람은 볼 수 없어요. 설정에서 백업 파일을 저장해 두면 다른 기기로 옮길 수 있어요.</footer>
      </div>
      {model && <Dock />}
      <DaySheet />
      <EntrySheet />
      <Onboarding />
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
