#!/usr/bin/env node
import { spawn, execSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(__dirname, "..");

// Full clean build before watch so dist/ is complete before Next.js reads it.
execSync("npm run build", { cwd: pkgRoot, stdio: "inherit" });

function run(command, args, name) {
  const child = spawn(command, args, {
    cwd: pkgRoot,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  child.on("exit", (code, signal) => {
    if (signal) return;
    if (code && code !== 0) {
      process.exitCode = code;
      shutdown(signal ?? "SIGTERM");
    }
  });
  return child;
}

const children = [
  run("node", ["scripts/build-css.js", "--watch"], "css"),
  run("npx", ["tsup", "--watch"], "tsup"),
];

function shutdown(signal = "SIGINT") {
  for (const child of children) {
    if (!child.killed) child.kill(signal);
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
