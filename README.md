# tiny

Realtime collaborative todo list built with TinyBase + Cloudflare Durable Objects.

## Features

- **User-based sharding** - Each user gets their own 128MB Durable Object
- **Real-time collaboration** - WebSocket sync between browser tabs
- **Server-side rendering** with Hono JSX (no loading flicker)
- **Rate limiting** - Protection against abuse
- **Modern stack** - TypeScript, Tailwind CSS, Alchemy deployment

## Architecture

```
User Request → Cloudflare Worker (Hono) → User-specific Durable Object
                      ↓                            ↓
              Pre-rendered JSX + WebSocket    Real-time sync
```

**User isolation:** `?userId=alice` → `user-alice` Durable Object

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

- **Storage**: 128MB per user (~100K todos per user)
- **Users**: Unlimited (each gets their own Durable Object)
- **Scale**: Suitable for most real-world applications

## Scaling Roadmap

**Current architecture handles most use cases.** When you need more:

### Phase 1: Unlimited Storage (D1 Hybrid)
```typescript
// Hot data in DO, cold storage in D1
const hotTodos = await durableObject.getRecentTodos();
const coldTodos = await db.prepare("SELECT * FROM todos WHERE updated_at < ?").bind(cutoff).all();
```

### Phase 2: Multi-tenancy
```typescript
// Organization-based sharding
const obj = env.TINYBASE_STORE.getByName(`org-${orgId}-user-${userId}`);
```

### Phase 3: Geographic Distribution
```typescript
// Regional DOs for latency optimization
const region = getClosestRegion(clientIP);
const obj = env.TINYBASE_STORE.getByName(`${region}-user-${userId}`);
```

**When to scale:** Each phase unlocks 10-100x more capacity. Start simple, scale when needed.

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

## Usage

Try different users to see isolation in action:

- `http://localhost:1338/?userId=alice`
- `http://localhost:1338/?userId=bob`
- `http://localhost:1338/?userId=team1`

Each user gets their own private todo list with real-time sync between browser tabs.

## Development

The app demonstrates several patterns:

1. **User-based sharding** - Automatic isolation via URL parameter
2. **Server-side data loading** - Eliminates loading spinners
3. **Real-time collaboration** - WebSocket sync between tabs
4. **Resource monitoring** - Storage usage displayed in UI
5. **Rate limiting** - 100 requests/minute per IP

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