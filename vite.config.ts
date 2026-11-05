/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages 주소가 https://아이디.github.io/aggim-note/ 이라서 base를 저장소 이름으로 맞춰요.
export default defineConfig({
  base: "/aggim-note/",
  plugins: [react()],
  test: {
    include: ["src/**/*.test.ts"],
    env: { TZ: "Asia/Seoul" },
  },
});
