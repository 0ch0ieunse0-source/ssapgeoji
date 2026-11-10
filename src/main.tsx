import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/tokens.css";
import "./styles/app.css";
import { pushEnabled, refreshPush, registerSW } from "./state/push";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// 매일 알림을 받을 일꾼(서비스 워커) 등록. 화면 파일은 저장하지 않아요
if (pushEnabled()) {
  registerSW();
  window.addEventListener("load", () => void refreshPush());
}
