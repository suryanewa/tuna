import { defineConfig } from "tsup";
import { writeFileSync, readFileSync } from "fs";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const pkg = require("./package.json");

/** Avoid wiping dist between watch rebuilds — Next reads linked chunks mid-compile. */
const isWatch = process.argv.includes("--watch");

export default defineConfig([
  // React component bundle
  {
    entry: ["src/index.ts"],
    format: ["esm"],
    dts: true,
    sourcemap: true,
    clean: !isWatch,
    external: ["react", "react-dom"],
    treeshake: true,
    define: {
      __RETUNE_VERSION__: JSON.stringify(pkg.version),
    },
    onSuccess: async () => {
      const file = "dist/index.js";
      const content = readFileSync(file, "utf-8");
      writeFileSync(file, `"use client";\n${content}`);
    },
  },
  // MCP server CLI binary
  {
    entry: ["src/mcp/cli.ts"],
    format: ["esm"],
    dts: false,
    sourcemap: false,
    clean: false,
    banner: { js: "#!/usr/bin/env node" },
  },
]);
