/**
 * Retune setup — auto-configure MCP server and install skill for detected AI tools.
 *
 * Usage: npx retune setup
 *
 * Detects Claude Code and Cursor, then:
 * 1. Configures MCP server in the tool's settings
 * 2. Installs the Retune skill for resolution guidance
 */

import { existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
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

  // Summary
  console.log("\n--- Setup Summary ---\n");
  for (const r of results) {
    const mcpStatus = r.mcp ? "configured" : "manual setup needed";
    const skillStatus = r.skill ? "installed" : "not installed";
    console.log(`  ${r.tool}: MCP ${mcpStatus}, Skill ${skillStatus}`);
  }
  console.log("");
}
