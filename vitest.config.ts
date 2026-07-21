import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["client/src/**/*.test.{ts,tsx}", "server/**/*.test.ts"],
    // Node 22+ ships a native, always-on `localStorage` global backed by a
    // file (see `--localstorage-file`). Without that flag it's a broken stub
    // missing methods like `.clear()`, and it shadows jsdom's own
    // localStorage implementation in the test environment. Disabling it here
    // lets jsdom's localStorage be the one actually used in tests.
    execArgv: ["--no-experimental-webstorage"],
  },
});
