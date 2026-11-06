import { Component, type ReactNode } from "react";
import { errorText } from "../lib/errors";

/** 화면을 그리다 오류가 나도 하얀 화면 대신 안내를 보여줘요. 기록(저장된 값)은 건드리지 않아요. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { err: unknown }> {
  state = { err: null as unknown };
  static getDerivedStateFromError(err: unknown) {
    return { err };
  }
  componentDidCatch(err: unknown) {
    // eslint-disable-next-line no-console
    console.error("[거지노트] 화면 오류", err);
  }
  render() {
    if (!this.state.err) return this.props.children;
    const msg = errorText(this.state.err);
    return (
        <section className="card crash" role="alert">
          <h2>화면을 여는 중에 문제가 생겼어요</h2>
          <p className="hint">기록은 그대로 저장돼 있어요. 아래 오류 내용을 캡처해서 알려주시면 고칠게요.</p>
          <pre className="crash-msg">{msg}</pre>
          <div className="row">
            <button
              className="btn line"
              style={{ flex: 1 }}
              onClick={() => {
                this.setState({ err: null });
                location.hash = "home";
              }}
            >
              홈으로
            </button>
            <button className="btn" style={{ flex: 1 }} onClick={() => location.reload()}>
              새로고침
            </button>
          </div>
        </section>
    );
  }
}
