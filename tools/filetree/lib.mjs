// The Files tree bench: a repository listing served as XO's /tree API (one folder per call), the page
// tools/filetree/bench.html with the real js/files.js and XO's CSS, and timing helpers (time to the next
// painted frame, long tasks). From the @pierre/trees evaluation (design-research/2026-11-pierre-trees-eval,
// xo/thread-1dce08). See README.md.
import { createRequire } from "module";
import fs from "fs";
const require = createRequire("/tmp/pw/node_modules/");
export const { chromium } = require("playwright-core");
export const EXE = `${process.env.HOME}/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell`;

export function loadSet(name) {
  const lines = fs.readFileSync(process.env.LISTING || `/tmp/pt-eval/data/${name}.txt`, "utf8").split("\n").filter(Boolean);
  const kids = new Map(); // dir rel → {dirs, files}
  const ensure = (p) => { if (!kids.has(p)) kids.set(p, { dirs: [], files: [] }); return kids.get(p); };
  ensure("");
  const paths = [];
  for (const l of lines) {
    const m = /^(.) (\d+) (.*)$/.exec(l); if (!m) continue;
    const [, y, sz, p] = m;
    const i = p.lastIndexOf("/"), parent = i < 0 ? "" : p.slice(0, i), name = p.slice(i + 1);
    const e = { name, relative_path: p, is_dir: y === "d", size_bytes: y === "d" ? null : Number(sz), modified_at: "2026-11-05T12:00:00Z", entries: null };
    if (y === "d") { ensure(parent).dirs.push(e); ensure(p); paths.push(p + "/"); } else { ensure(parent).files.push(e); paths.push(p); }
  }
  for (const v of kids.values()) { v.dirs.sort((a, b) => a.name.localeCompare(b.name)); v.files.sort((a, b) => a.name.localeCompare(b.name)); }
  return { kids, paths };
}

export async function open({ port, set, theme = "dark", width = 1600, height = 1000, dpr = 1, throttle = 1 }) {
  const browser = await chromium.launch({ executablePath: EXE, args: ["--enable-precise-memory-info"] });
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr });
  await ctx.addInitScript((t) => { try { localStorage.setItem("cv-theme", t); } catch {} }, theme);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.error("pageerror", e.message));
  await page.route("**/api/**", (route) => {
    const u = new URL(route.request().url());
    const m = /\/api\/xo-projects\/[^/]+\/tree$/.exec(u.pathname);
    if (route.request().method() !== "GET" || !m) return route.fulfill({ status: 404, body: "{}" });
    const rel = u.searchParams.get("relative_path") || "";
    const k = set.kids.get(rel);
    if (!k) return route.fulfill({ status: 404, body: "{}" });
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ project_id: "proj", relative_path: rel, dirs: k.dirs, files: k.files }) });
  });
  await page.goto(`http://127.0.0.1:${port}/tools/filetree/bench.html`);
  await page.waitForFunction(() => window.B && window.B.ready);
  await page.evaluate(() => {
    window.LT = [];
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.LT.push(e.duration); }).observe({ type: "longtask", buffered: false });
    window.frame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
    // time an action to the frame after it, plus long tasks during it
    window.timed = async (fn) => { await new Promise((r) => setTimeout(r, 100)); window.LT.length = 0; const t0 = performance.now(); await fn(); await window.frame(); const ms = performance.now() - t0; await new Promise((r) => setTimeout(r, 120)); return { ms: Math.round(ms), long: window.LT.map(Math.round), maxLong: Math.round(Math.max(0, ...window.LT)) }; };
    window.waitFor = (sel, root = document) => new Promise((res) => { const f = () => (root.querySelector(sel) ? res() : requestAnimationFrame(f)); f(); });
  });
  const cdp = await ctx.newCDPSession(page);
  if (throttle > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttle });
  return { browser, page, cdp };
}
