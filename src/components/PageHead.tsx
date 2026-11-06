import { useEffect, useRef } from "react";
import { useApp } from "../state/app";
import { Icon } from "./common";

/** 왼쪽 위 뒤로가기 + 페이지 제목 (공지사항, 설정 하위 페이지) */
export function PageHead({ title, fallback }: { title: string; fallback: string }) {
  const { goBack } = useApp();
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, [title]);
  return (
    <div className="page-head">
      <button className="pbtn" aria-label="뒤로가기" onClick={() => goBack(fallback)}>
        {Icon.prev}
      </button>
      <h1 ref={ref} tabIndex={-1}>
        {title}
      </h1>
      <span aria-hidden="true" />
    </div>
  );
}
