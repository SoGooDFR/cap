// Seeds the widget/wasm assets baked into the image (see Dockerfile "assets"
// stage) into Redis, so the asset server can serve them without any runtime
// egress. Run once per deploy (the Helm chart wires this as a hook Job).
//
//   bun run scripts/seed-assets.js
//
// Honors the same REDIS_URL / REDIS_CLUSTER / REDIS_PREFIX env as the server.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "../src/db.js";

const dir =
  process.env.ASSET_BUNDLE_DIR || join(import.meta.dir, "..", "asset-bundle");

const versions = JSON.parse(readFileSync(join(dir, "versions.json"), "utf8"));

await db.set("asset:widget.js", readFileSync(join(dir, "widget.js"), "utf8"));
await db.set("asset:floating.js", readFileSync(join(dir, "floating.js"), "utf8"));
await db.set("asset:cap_wasm_bg.wasm", readFileSync(join(dir, "cap_wasm_bg.wasm")));
await db.set("asset:cap_wasm.js", readFileSync(join(dir, "cap_wasm.js"), "utf8"));

// Matching versions + a fresh lastUpdate stop the server's periodic refresh
// from attempting an (egress) re-download.
await db.set(
  "asset:cache-config",
  JSON.stringify({
    versions: { widget: versions.widget, wasm: versions.wasm },
    lastUpdate: Date.now(),
  }),
);

console.log(
  `[seed-assets] seeded widget@${versions.widget} wasm@${versions.wasm} into Redis`,
);
process.exit(0);
