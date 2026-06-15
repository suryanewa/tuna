import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

const distDir = join(__dirname, "..", "..", "dist");
const manifestPath = join(distDir, "manifest.json");

interface ExtensionManifest {
  background?: { service_worker?: string };
  content_scripts?: Array<{ js?: string[]; css?: string[] }>;
}

function readManifest(): ExtensionManifest {
  return JSON.parse(readFileSync(manifestPath, "utf-8")) as ExtensionManifest;
}

describe("Chrome extension assets", () => {
  it("copies manifest references to existing dist files", () => {
    expect(existsSync(manifestPath), "manifest.json should exist; run the extension build first").toBe(true);

    const manifest = readManifest();
    const referencedFiles = [
      manifest.background?.service_worker,
      ...(manifest.content_scripts ?? []).flatMap((script) => [
        ...(script.js ?? []),
        ...(script.css ?? []),
      ]),
    ].filter((file): file is string => !!file);

    expect(referencedFiles.length).toBeGreaterThan(0);
    for (const file of referencedFiles) {
      expect(existsSync(join(distDir, file)), `${file} should exist in dist`).toBe(true);
    }
  });

  it("emits self-contained content and background bundles", () => {
    const manifest = readManifest();
    const bundles = [
      manifest.background?.service_worker,
      ...(manifest.content_scripts ?? []).flatMap((script) => script.js ?? []),
    ].filter((file): file is string => !!file);

    for (const file of bundles) {
      const source = readFileSync(join(distDir, file), "utf-8");
      expect(source).not.toMatch(/from ["']react["']/);
      expect(source).not.toMatch(/from ["']react-dom/);
      expect(source).not.toMatch(/import\(["']@xenova\/transformers["']\)/);
    }
  });
});
