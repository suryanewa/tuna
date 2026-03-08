import { defineConfig } from "tsup";
import { writeFileSync, readFileSync } from "fs";

export default defineConfig([
  // React component bundle
  {
    entry: ["src/index.ts"],
    format: ["esm"],
    dts: true,
    sourcemap: true,
    clean: true,
    external: ["react", "react-dom"],
    treeshake: true,
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
