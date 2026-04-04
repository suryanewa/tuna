/**
 * Retune setup — auto-configure MCP server and install skill for detected AI tools.
 *
 * Usage: npx retune setup
 *
 * Detects Claude Code and Cursor, then:
 * 1. Configures MCP server in the tool's settings
 * 2. Installs the Retune skill for resolution guidance
 */

import { existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join, dirname, extname } from "path";
import { homedir } from "os";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface SetupResult {
  tool: string;
  mcp: boolean;
  skill: boolean;
}

function log(msg: string) {
  console.log(`[retune] ${msg}`);
}

function warn(msg: string) {
  console.warn(`[retune] ⚠ ${msg}`);
}

/** Find the skill directory (bundled with the npm package) */
function findSkillSource(): string | null {
  // In dist/: skill/ is at package root, so go up from dist/
  const fromDist = join(__dirname, "..", "..", "skill", "SKILL.md");
  if (existsSync(fromDist)) return dirname(fromDist);

  // During development: src/mcp/ → ../../skill/
  const fromSrc = join(__dirname, "..", "..", "skill", "SKILL.md");
  if (existsSync(fromSrc)) return dirname(fromSrc);

  return null;
}

/** Install skill for Claude Code */
function installClaudeCodeSkill(skillSource: string): boolean {
  const skillDir = join(homedir(), ".claude", "skills", "retune-visual-changes");
  const targetFile = join(skillDir, "SKILL.md");
  const sourceFile = join(skillSource, "SKILL.md");

  try {
    mkdirSync(skillDir, { recursive: true });
    copyFileSync(sourceFile, targetFile);
    log(`Skill installed: ${targetFile}`);
    return true;
  } catch (err: any) {
    warn(`Could not install Claude Code skill: ${err.message}`);
    return false;
  }
}

/** Install skill for Cursor */
function installCursorSkill(skillSource: string): boolean {
  const skillDir = join(homedir(), ".cursor", "skills", "retune-visual-changes");
  const targetFile = join(skillDir, "SKILL.md");
  const sourceFile = join(skillSource, "SKILL.md");

  try {
    mkdirSync(skillDir, { recursive: true });
    copyFileSync(sourceFile, targetFile);
    log(`Skill installed: ${targetFile}`);
    return true;
  } catch (err: any) {
    warn(`Could not install Cursor skill: ${err.message}`);
    return false;
  }
}

/** Configure MCP server for Claude Code */
function setupClaudeCodeMcp(): boolean {
  const configPath = join(homedir(), ".claude", "claude_desktop_config.json");
  const configDir = dirname(configPath);

  try {
    mkdirSync(configDir, { recursive: true });

    let config: any = {};
    if (existsSync(configPath)) {
      config = JSON.parse(readFileSync(configPath, "utf-8"));
    }

    if (!config.mcpServers) config.mcpServers = {};

    config.mcpServers.retune = {
      command: "npx",
      args: ["retune"],
    };

    writeFileSync(configPath, JSON.stringify(config, null, 2));
    log(`MCP configured: ${configPath}`);
    return true;
  } catch (err: any) {
    warn(`Could not configure Claude Code MCP: ${err.message}`);
    return false;
  }
}

/** Configure MCP server for Cursor (global) */
function setupCursorMcp(): boolean {
  const configPath = join(homedir(), ".cursor", "mcp.json");
  const configDir = dirname(configPath);

  try {
    mkdirSync(configDir, { recursive: true });

    let config: any = {};
    if (existsSync(configPath)) {
      config = JSON.parse(readFileSync(configPath, "utf-8"));
    }

    if (!config.mcpServers) config.mcpServers = {};

    config.mcpServers.retune = {
      command: "npx",
      args: ["retune"],
    };

    writeFileSync(configPath, JSON.stringify(config, null, 2));
    log(`MCP configured: ${configPath}`);
    return true;
  } catch (err: any) {
    warn(`Could not configure Cursor MCP: ${err.message}`);
    return false;
  }
}

/** Detect which AI tools are installed */
function detectTools(): string[] {
  const tools: string[] = [];

  // Claude Code — check for ~/.claude directory
  if (existsSync(join(homedir(), ".claude"))) {
    tools.push("claude-code");
  }

  // Cursor — check for ~/.cursor directory
  if (existsSync(join(homedir(), ".cursor"))) {
    tools.push("cursor");
  }

  return tools;
}

/** Find the public directory for the project's framework */
function findPublicDir(): string | null {
  const candidates = ["public", "static"];
  for (const dir of candidates) {
    const path = join(process.cwd(), dir);
    if (existsSync(path) && statSync(path).isDirectory()) return path;
  }
  // Default to public/ (most common — Next.js, Vite, CRA, Remix)
  return join(process.cwd(), "public");
}

/** Scan CSS files for custom properties and extract tokens */
function extractTokensFromCss(): Record<string, Record<string, { value: string; variable: string }>> {
  const tokens: Record<string, Record<string, { value: string; variable: string }>> = {};
  const cssVarRe = /--([\w-]+)\s*:\s*([^;]+)/g;

  // Framework internal prefixes to skip
  const skipPrefixes = ["tw-", "chakra-", "mantine-", "radix-", "nextui-"];

  function scanDir(dir: string) {
    if (!existsSync(dir)) return;
    try {
      for (const entry of readdirSync(dir)) {
        const fullPath = join(dir, entry);
        try {
          const stat = statSync(fullPath);
          if (stat.isDirectory()) {
            // Skip node_modules, .git, dist, build
            if (["node_modules", ".git", "dist", "build", ".next", ".cache"].includes(entry)) continue;
            scanDir(fullPath);
          } else if ([".css", ".scss", ".less"].includes(extname(entry))) {
            const content = readFileSync(fullPath, "utf-8");
            let match;
            while ((match = cssVarRe.exec(content)) !== null) {
              const name = match[1];
              const value = match[2].trim();

              // Skip framework internals
              if (skipPrefixes.some(p => name.startsWith(p))) continue;
              // Skip empty or var() reference values
              if (!value || value.startsWith("var(")) continue;

              // Categorize by name pattern
              let category: string | null = null;
              if (/^(color|bg|text-color|border-color|foreground|background|accent|brand|primary|secondary|success|danger|warning|error)/i.test(name)) {
                category = "colors";
              } else if (/^(spacing|space|gap|pad|margin)/i.test(name)) {
                category = "spacing";
              } else if (/^(size|width|height)/i.test(name)) {
                category = "sizing";
              } else if (/^(radius|border-radius)/i.test(name)) {
                category = "radii";
              } else if (/^(border-width)/i.test(name)) {
                category = "borderWidths";
              } else if (/^(shadow|elevation)/i.test(name)) {
                category = "shadows";
              } else if (/^(font|text|leading|tracking|letter)/i.test(name)) {
                category = "typography";
              }

              if (!category) continue;

              if (!tokens[category]) tokens[category] = {};
              tokens[category][name] = { value, variable: `--${name}` };
            }
          }
        } catch { /* permission errors, etc. */ }
      }
    } catch { /* read errors */ }
  }

  // Scan common source directories
  for (const dir of ["src", "app", "styles", "css", "."]) {
    scanDir(join(process.cwd(), dir === "." ? "" : dir));
  }

  return tokens;
}

/** Generate or update the manifest with extracted tokens */
function generateManifest(): boolean {
  const publicDir = findPublicDir();
  if (!publicDir) return false;

  const manifestPath = join(publicDir, "retune.manifest.json");

  // Check if manifest already exists
  let manifest: Record<string, any> = {};
  if (existsSync(manifestPath)) {
    try {
      manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
      if (manifest.tokens) {
        // Tokens already exist, don't overwrite
        return false;
      }
    } catch { /* invalid JSON, regenerate */ }
  }

  const tokens = extractTokensFromCss();
  const tokenCount = Object.values(tokens).reduce((sum, cat) => sum + Object.keys(cat).length, 0);

  if (tokenCount === 0) {
    log("No CSS custom properties found in the project.");
    return false;
  }

  manifest.tokens = tokens;

  // Ensure public directory exists
  if (!existsSync(publicDir)) {
    mkdirSync(publicDir, { recursive: true });
  }

  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  log(`Manifest generated: ${manifestPath} (${tokenCount} tokens)`);
  return true;
}

export async function setup() {
  log("Setting up Retune...\n");

  const tools = detectTools();
  if (tools.length === 0) {
    warn("No supported AI tools detected (Claude Code, Cursor).");
    log("Install Claude Code or Cursor, then run this command again.");
    return;
  }

  log(`Detected: ${tools.join(", ")}\n`);

  const skillSource = findSkillSource();
  if (!skillSource) {
    warn("Could not find skill files. The package may be incomplete.");
  }

  const results: SetupResult[] = [];

  for (const tool of tools) {
    const result: SetupResult = { tool, mcp: false, skill: false };

    switch (tool) {
      case "claude-code":
        result.mcp = setupClaudeCodeMcp();
        if (skillSource) {
          result.skill = installClaudeCodeSkill(skillSource);
        }
        break;

      case "cursor":
        result.mcp = setupCursorMcp();
        if (skillSource) {
          result.skill = installCursorSkill(skillSource);
        }
        break;
    }

    results.push(result);
  }

  // Generate manifest with tokens
  const manifestGenerated = generateManifest();

  // Summary
  console.log("\n--- Setup Summary ---\n");
  for (const r of results) {
    const mcpStatus = r.mcp ? "configured" : "manual setup needed";
    const skillStatus = r.skill ? "installed" : "not installed";
    console.log(`  ${r.tool}: MCP ${mcpStatus}, Skill ${skillStatus}`);
  }
  if (manifestGenerated) {
    console.log(`  manifest: tokens extracted`);
  }
  console.log("");

  // Prompt the agent to complete the manifest with components
  if (manifestGenerated) {
    console.log("--- Next Step ---\n");
    console.log("The manifest has design tokens but needs component definitions.");
    console.log("Scan the project's React components and add them to the");
    console.log("\"components\" section of retune.manifest.json.\n");
    console.log("For each component, include:");
    console.log("  - Props with types (string, number, boolean, enum, function)");
    console.log("  - For enum props, list all allowed values");
    console.log("  - For props that map to CSS classes, include class_map");
    console.log("  - For components with useState, include state hooks");
    console.log("");
    console.log("After updating the manifest, call retune_manifest_loaded");
    console.log("to notify the overlay.\n");
  }
}
