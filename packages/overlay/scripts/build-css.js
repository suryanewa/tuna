#!/usr/bin/env node
import { readFileSync, writeFileSync, watch } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const cssPath = resolve(__dirname, "../src/overlay/overlay.css");
const outPath = resolve(__dirname, "../src/overlay/overlay-css.ts");
const watchMode = process.argv.includes("--watch");

function buildCss() {
  const css = readFileSync(cssPath, "utf8");
  const ts = `// AUTO-GENERATED from overlay.css — do not edit directly.\nexport default ${JSON.stringify(css)};\n`;
  writeFileSync(outPath, ts);
  console.log(`[build-css] Generated overlay-css.ts (${css.length} chars)`);
}

buildCss();

if (watchMode) {
  let debounce = null;
  watch(cssPath, () => {
    clearTimeout(debounce);
    debounce = setTimeout(buildCss, 50);
  });
  console.log("[build-css] Watching overlay.css");
}
