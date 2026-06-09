import { defineConfig } from "tsup";
import { writeFileSync, readFileSync } from "fs";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const pkg = require("./package.json");
const isWatch = process.argv.includes("--watch");
const USE_CLIENT_PREFIX = '"use client";\n';

export default defineConfig([
  // React component bundle — single file (no chunk splits) for stable linked-package HMR
  {
    entry: ["src/index.ts"],
    format: ["esm"],
    dts: !isWatch,
    sourcemap: true,
    clean: false,
    splitting: false,
    external: ["react", "react-dom"],
    treeshake: true,
    define: {
      __RETUNE_VERSION__: JSON.stringify(pkg.version),
    },
    ignoreWatch: isWatch ? ["**/overlay-css.ts"] : undefined,
    onSuccess: async () => {
      const file = "dist/index.js";
      const raw = readFileSync(file, "utf-8");
      const body = raw.startsWith(USE_CLIENT_PREFIX)
        ? raw.slice(USE_CLIENT_PREFIX.length)
        : raw.startsWith('"use client";')
          ? raw.slice('"use client";'.length).replace(/^\n/, "")
          : raw;
      const next = `${USE_CLIENT_PREFIX}${body}`;
      if (next !== raw) writeFileSync(file, next);
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
