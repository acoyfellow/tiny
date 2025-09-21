# TinyBase + Cloudflare Durable Objects

A minimal example of building real-time collaborative apps with TinyBase and Cloudflare Durable Objects.

## Features

- **Server-side rendering** with Hono JSX
- **Real-time persistence** via Cloudflare Durable Objects
- **No flicker loading** - data pre-rendered on the edge
- **Modern stack** - TypeScript, Tailwind CSS, Alchemy deployment

## Architecture

```
User Request → Cloudflare Worker (Hono) → Durable Object → Storage
                      ↓
              Pre-rendered JSX with data
```

## Quick Start

1. **Install dependencies**
   ```bash
   bun install
   ```

2. **Run development server**
   ```bash
   bun dev
   ```

3. **Deploy to Cloudflare**
   ```bash
   bun deploy
   ```

## Project Structure

```
src/
├── worker.tsx          # Main worker with JSX frontend
└── durable-object.ts   # Persistent storage logic

alchemy.run.ts          # Infrastructure as code
TODO.md                 # Scaling architecture notes
```

## Current Limits

- **Storage**: 128MB per Durable Object (~100K todos)
- **Scope**: Single global store (no multi-tenancy)
- **Scale**: Suitable for prototypes and small apps

See `TODO.md` for scaling strategies including user sharding, organization isolation, and hybrid architectures.

## Tech Stack

- **Runtime**: Cloudflare Workers
- **Framework**: Hono + JSX
- **Styling**: Tailwind CSS (CDN)
- **Storage**: Cloudflare Durable Objects
- **Deployment**: Alchemy (Infrastructure as Code)
- **Package Manager**: Bun

## Why This Stack?

- **Edge-first**: Code runs close to users globally
- **Zero configuration**: No databases to provision
- **Type-safe**: End-to-end TypeScript
- **Cost-effective**: Pay only for usage
- **Developer experience**: Hot reloading, modern tooling

## Development

The app demonstrates several patterns:

1. **Server-side data loading** - Eliminates loading spinners
2. **Progressive enhancement** - Works without JavaScript
3. **Real-time updates** - Changes persist immediately
4. **Resource monitoring** - Storage usage displayed in UI

## Deployment

Uses Alchemy for infrastructure as code:

```typescript
export const worker = await Worker("worker", {
  entrypoint: "./src/worker.tsx",
  bindings: {
    TINYBASE_STORE: DurableObjectNamespace("TinyBaseStore")
  }
});
```

## License

MIT