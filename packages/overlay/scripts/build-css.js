#!/usr/bin/env node
import { readFileSync, writeFileSync, watch } from "fs";
import { execSync } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(__dirname, "..");
const cssPath = resolve(__dirname, "../src/overlay/overlay.css");
const outPath = resolve(__dirname, "../src/overlay/overlay-css.ts");
const watchMode = process.argv.includes("--watch");

function buildCss() {
  const css = readFileSync(cssPath, "utf8");
  const ts = `// AUTO-GENERATED from overlay.css — do not edit directly.\nexport default ${JSON.stringify(css)};\n`;
  let existing = "";
  try {
    existing = readFileSync(outPath, "utf8");
  } catch {
    // First run — file does not exist yet.
  }
  if (existing === ts) return false;
  writeFileSync(outPath, ts);
  console.log(`[build-css] Generated overlay-css.ts (${css.length} chars)`);
  return true;
}

const changed = buildCss();
if (watchMode && changed) {
  execSync("npx tsup", { cwd: pkgRoot, stdio: "inherit" });
}

if (watchMode) {
  let debounce = null;
  watch(cssPath, () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      if (!buildCss()) return;
      execSync("npx tsup", { cwd: pkgRoot, stdio: "inherit" });
    }, 100);
  });
  console.log("[build-css] Watching overlay.css");
}
