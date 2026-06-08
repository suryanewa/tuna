# Playground (retune-site)

The [Retune marketing site](https://github.com/khadgi-sujan/retune-site) lives here as the monorepo playground. It imports the local `packages/overlay` package instead of the published `retune` npm package.

## Development

From the repo root:

```bash
npm install
npm run dev
```

Open http://localhost:3001. One command starts overlay CSS/TypeScript watch and the Next.js dev server.

To run only the playground (start `npm run dev:overlay` in another terminal first):

```bash
npm run dev:playground
```
