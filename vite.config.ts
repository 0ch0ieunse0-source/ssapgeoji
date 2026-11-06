/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

// 버전 이름은 커밋(GitHub Actions의 GITHUB_SHA)으로 정해요. 코드가 그대로면 다시 빌드해도 버전이 같아서
// '새 버전이 있어요'가 뜨지 않아요. (테스트 버전을 올릴 때 친구들 앱에 새 버전 알림이 뜨던 문제)
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env || {};
const APP_VERSION = env.GITHUB_SHA || new Date().toISOString();
const versionFile = (): Plugin => ({
  name: "version-json",
  apply: "build",
  generateBundle() {
    this.emitFile({ type: "asset", fileName: "version.json", source: JSON.stringify({ version: APP_VERSION }) });
  },
});

// GitHub Pages 주소가 https://아이디.github.io/ssapgeoji/ 이라서 base를 저장소 이름으로 맞춰요.
// 디자인 테스트 버전은 BASE=/ssapgeoji/test/ 로 따로 빌드해요 (.github/workflows/deploy.yml)
export default defineConfig({
  base: env.BASE || "/ssapgeoji/",
  plugins: [react(), versionFile()],
  define: { __APP_VERSION__: JSON.stringify(APP_VERSION) },
  test: {
    include: ["src/**/*.test.ts"],
    env: { TZ: "Asia/Seoul" },
  },
});
