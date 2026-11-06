/** 프로필 사진 (없거나 꺼 두었으면 닉네임 첫 글자) */
export function Avatar({ src, name, size = 44 }: { src?: string | null; name: string; size?: number }) {
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.42 }} aria-hidden="true">
      {src ? <img src={src} alt="" width={size} height={size} /> : (name || "?").slice(0, 1)}
    </span>
  );
}
