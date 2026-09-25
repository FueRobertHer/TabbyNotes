import { defineConfig } from "vitest/config";
import { WxtVitest } from "wxt/testing/vitest-plugin";

export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    // Node 25+ ships its own localStorage global, which hides jsdom's.
    execArgv: ["--no-experimental-webstorage"],
  },
});
