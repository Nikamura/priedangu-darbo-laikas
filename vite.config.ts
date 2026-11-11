import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { defineConfig, type Plugin } from "vite";

const root = new URL("./web", import.meta.url).pathname;

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? listFiles(p) : [p];
  });
}

/**
 * Emits sw.js with the exact list of built files, so the whole app (and the
 * shelter list) is cached on first visit and keeps working without a network.
 */
function serviceWorker(): Plugin {
  return {
    name: "offline-service-worker",
    apply: "build",
    generateBundle(_, bundle) {
      const publicDir = join(root, "public");
      // Precache what an emergency needs: the app, the shelter list and the fonts for our five
      // languages. Illustrations are cached lazily so the first load stays light.
      const files = [
        "./",
        ...Object.keys(bundle)
          .filter((f) => !f.endsWith(".woff2") || /(latin|cyrillic)/.test(f))
          .map((f) => `./${f}`),
        ...listFiles(publicDir)
          .map((f) => `./${relative(publicDir, f)}`)
          .filter((f) => !f.startsWith("./img/") && !f.endsWith(".DS_Store") && !f.endsWith("sw.js")),
      ];
      const version = Date.now().toString(36);
      this.emitFile({
        type: "asset",
        fileName: "sw.js",
        source: `const VERSION = ${JSON.stringify(version)};
const PRECACHE = ${JSON.stringify(files)};
const APP = "app-" + VERSION;
const TILES = "tiles-v1";
const MAX_TILES = 600;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(APP).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("app-") && k !== APP).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function trimTiles() {
  const c = await caches.open(TILES);
  const keys = await c.keys();
  for (const k of keys.slice(0, Math.max(0, keys.length - MAX_TILES))) await c.delete(k);
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Map tiles: use the network, fall back to tiles seen before.
  if (url.hostname.endsWith("tile.openstreetmap.org")) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) caches.open(TILES).then((c) => c.put(req, res.clone()).then(trimTiles));
          return res.clone();
        })
        .catch(() => caches.match(req).then((r) => r || Response.error())),
    );
    return;
  }
  if (url.origin !== location.origin) return;

  // Pages and the shelter list: fresh when online, cached when not.
  if (req.mode === "navigate" || url.pathname.endsWith("/data/shelters.json")) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(APP).then((c) => c.put(req.mode === "navigate" ? "./" : req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req.mode === "navigate" ? "./" : req, { ignoreSearch: true }).then((r) => r || Response.error())),
    );
    return;
  }

  // Hashed assets, fonts and images never change: cache first, keep what we fetch.
  e.respondWith(
    caches.match(req).then(
      (r) =>
        r ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(APP).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
`,
      });
    },
  };
}

export default defineConfig({
  root,
  // GitHub Pages serves the site under /<repo>/; the deploy workflow passes it in.
  base: process.env.BASE_PATH ? `${process.env.BASE_PATH.replace(/\/$/, "")}/` : "/",
  build: { outDir: "dist", emptyOutDir: true, target: "es2022" },
  plugins: [serviceWorker()],
  server: { host: true },
});
