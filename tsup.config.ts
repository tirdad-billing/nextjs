import { defineConfig } from "tsup";

export default defineConfig([
  // Main entry + Next.js adapter
  {
    entry: {
      index: "src/index.ts",
      next: "src/next.ts",
      router: "src/router.ts",
    },
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    clean: true,
    splitting: true,
    treeshake: true,
    external: ["next", "react", "react-dom"],
  },
  // Client SDK (browser-safe, no server deps)
  {
    entry: {
      "client/index": "src/client/index.ts",
    },
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    splitting: false,
    treeshake: true,
    external: ["react", "react-dom"],
  },
  // Testing utilities
  {
    entry: {
      "testing/index": "src/testing/index.ts",
    },
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    splitting: false,
    treeshake: true,
  },
]);
