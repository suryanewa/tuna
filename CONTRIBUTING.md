# Contributing to Tuna

## Getting Started

```bash
git clone https://github.com/khadgi-sujan/tuna.git
cd tuna
npm install
```

### Development

The overlay source is in `packages/overlay/src/`. The test app is in `playground/`.

```bash
cd packages/overlay
npm run dev          # Watch mode — rebuilds on file changes
```

In a separate terminal:

```bash
cd playground
npm run dev          # Starts the test app at localhost:3002
```

### Building

```bash
cd packages/overlay
npx tsup             # Build the overlay package
```

CSS is source-of-truth in `src/overlay/overlay.css`. The file `src/overlay/overlay-css.ts` is auto-generated -- never edit it directly. After editing CSS:

```bash
node scripts/build-css.js    # Regenerate overlay-css.ts
npx tsup                     # Rebuild
```

### Testing

```bash
npx vitest run       # Run all tests (from repo root)
npx vitest run src/variables/resolver.test.ts   # Run specific test file
```

Tests are in `src/__tests__/` and colocated test files (e.g., `resolver.test.ts`). Write pure function tests -- no jsdom, no browser APIs. Mock what you need.

## Code Conventions

### Commits

Follow conventional commits:

- `feat:` — new feature
- `fix:` — bug fix
- `docs:` — documentation only
- `chore:` — build, config, version bumps
- `refactor:` — code change that doesn't add features or fix bugs
- `test:` — adding or updating tests

Keep commit messages concise. One sentence for the title, details in the body if needed.

### Branches

- `main` — release branch, tagged versions published to npm
- `dev/v*` — development branches for upcoming releases
- Feature branches: `fix/description` or `feat/description`

### Pull Requests

- One logical change per PR
- Include a clear description of what changed and why
- Ensure `npx vitest run` passes (all tests green)
- Ensure `npx tsup` builds without errors
- Don't include unrelated changes

### Code Style

- TypeScript strict mode
- No unnecessary comments -- code should be self-explanatory
- Don't add docstrings to code you didn't change
- Prefer editing existing files over creating new ones
- Keep changes minimal -- don't refactor surrounding code in a bug fix PR

### Panel Layout

The property panel uses consistent spacing:

- Row groups: `padding: 0 48px 0 16px` (48px right padding for alignment)
- Exception: rows with split buttons use `padding-right: 8px`
- Exception: selector field rows use `padding: 0`
- New sections should follow this pattern

### CSS

- `overlay.css` is the source of truth -- never edit `overlay-css.ts`
- Run `node scripts/build-css.js` after CSS changes
- Use existing CSS variables (`--tuna-text`, `--tuna-surface-hover`, etc.)
- Text hierarchy: `--tuna-text` (90%), `--tuna-text-secondary` (70%), `--tuna-text-tertiary` (50%)

## Architecture Overview

```
packages/overlay/src/
  overlay/          — Main UI (Tuna.tsx, PropertyPanel.tsx, ElementTree.tsx)
  selector/         — Element picking, identification, fiber access (picker.ts, identifier.ts)
  engine/           — Change tracking, output formatting, live preview
  ui/               — Reusable input components (ColorInput, SelectInput, NumberInput, etc.)
  variables/        — Design token registry, resolver, categories
  manifest/         — Manifest generation prompts
  mcp/              — MCP server, CLI, setup command
  inspector/        — Style extraction, token scanning
  bridge/           — WebSocket client for overlay-to-MCP communication
  drag/             — Drag detection utilities
```

### Key Patterns

- **Shadow DOM**: The overlay renders inside a Shadow DOM to isolate styles from the user's app
- **Refs over state**: Drag operations, resize, and picker use refs to avoid re-renders during interaction
- **WeakMap for element tracking**: Element-to-data mappings use WeakMap so garbage collection works naturally
- **Manifest as authority**: When a manifest exists, it replaces runtime-scanned tokens for covered categories

## Questions?

Open an issue at https://github.com/khadgi-sujan/tuna/issues
