import { defineConfig } from "tsup";
import { writeFileSync, readFileSync } from "fs";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ["react", "react-dom"],
  treeshake: true,
  onSuccess: async () => {
    // Prepend "use client" directive to the built output
    const file = "dist/index.js";
    const content = readFileSync(file, "utf-8");
    writeFileSync(file, `"use client";\n${content}`);
  },
});
