import alchemy from "alchemy";
import { DurableObjectNamespace, Worker } from "alchemy/cloudflare";
import type { TinyBaseStore } from "./src/durable-object.ts";

const app = await alchemy("tinybase-cf-poc");

export const worker = await Worker("worker", {
  name: `${app.name}-${app.stage}-worker`,
  entrypoint: "./src/worker.tsx",
  bindings: {
    TINYBASE_STORE: DurableObjectNamespace<TinyBaseStore>("TinyBaseStore", {
      className: "TinyBaseStore",
    }),
  },
  url: true,
  bundle: {
    format: "esm",
    target: "es2020",
  },
});

console.log(worker.url);

await app.finalize();