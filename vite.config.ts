/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

// 빌드할 때마다 새 버전 이름을 만들어요. 앱은 version.json과 비교해서 새 버전이 있으면 알려줘요.
const APP_VERSION = new Date().toISOString();
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
  base: (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.BASE || "/ssapgeoji/",
  plugins: [react(), versionFile()],
  define: { __APP_VERSION__: JSON.stringify(APP_VERSION) },
  test: {
    include: ["src/**/*.test.ts"],
    env: { TZ: "Asia/Seoul" },
  },
});
