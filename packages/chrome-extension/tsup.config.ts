import { copyFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import { defineConfig } from "tsup";
import overlayPkg from "../overlay/package.json" assert { type: "json" };

export default defineConfig({
  entry: {
    background: "src/background.ts",
    content: "src/content.tsx",
  },
  outDir: "dist",
  format: ["iife"],
  platform: "browser",
  target: "chrome114",
  bundle: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: false,
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
    __TUNA_VERSION__: JSON.stringify(overlayPkg.version),
  },
  noExternal: [/.*/],
  esbuildPlugins: [
    {
      name: "tuna-extension-transformers-stub",
      setup(build) {
        build.onResolve({ filter: /^@xenova\/transformers$/ }, () => ({
          path: resolve("src/transformers-stub.ts"),
        }));
      },
    },
  ],
  onSuccess: async () => {
    mkdirSync("dist", { recursive: true });
    copyFileSync("public/manifest.json", "dist/manifest.json");
  },
});
