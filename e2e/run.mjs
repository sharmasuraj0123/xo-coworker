// @ts-check

/** @import { Case, Tools } from "./lib/types.d.ts" */

// The fast UI lane: `node e2e/run.mjs [filter]`; exit 0 passed, 1 failed or over budget, 2 not run.

import { readdirSync, readFileSync, existsSync, rmSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { startSpace } from "./lib/space.mjs";
import { probe, settle, POLL_MS } from "./lib/settle.mjs";
import { compareAria } from "./lib/aria.mjs";
import { findPlaywright, launch } from "./lib/browser.mjs";

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(DIR);
const filter = process.argv[2] || "";
const BUDGET = Number(process.env.E2E_BUDGET_MS) || 180_000;
const CASE_MS = Number(process.env.E2E_CASE_MS) || 30_000;
const UPDATE = process.env.UPDATE === "1";
const t0 = Date.now();
/** @type {Set<string>} */
const used = new Set();

/** Every spec's cases whose "file › name" contains the filter. @returns {Promise<Case[]>} */
async function collect() {
  const out = [];
  for (const f of readdirSync(join(DIR, "specs")).filter((x) => x.endsWith(".spec.mjs")).sort()) {
    const mod = await import(pathToFileURL(join(DIR, "specs", f)).href);
    for (const c of mod.cases || []) {
      const file = f.replace(/\.spec\.mjs$/, "");
      if (`${file} › ${c.name}`.includes(filter)) out.push({ file, ...c });
    }
  }
  return out;
}

const seedOf = (/** @type {string} */ name) => JSON.parse(readFileSync(join(DIR, "seeds", `${name}.json`), "utf8"));
const slug = (/** @type {string} */ s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export const VIEWPORTS = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } };

/** Every golden under e2e/snapshots, relative to it. @param {string} [dir] @returns {string[]} */
const goldens = (dir = join(DIR, "snapshots")) => !existsSync(dir) ? [] : readdirSync(dir, { withFileTypes: true }).flatMap((d) => d.isDirectory() ? goldens(join(dir, d.name)) : d.name.endsWith(".aria.yml") ? [join(dir, d.name)] : []);

/** One case in its own Space and browser context. @param {any} browser @param {Case} c */
async function runCase(browser, c) {
  const space = await startSpace({ root: ROOT, seed: typeof c.seed === "string" ? seedOf(c.seed) : c.seed || {} });
  const vp = typeof c.viewport === "object" ? c.viewport : VIEWPORTS[c.viewport || "desktop"];
  /** @type {any} */
  let ctx = null;
  /** @type {string[]} */
  const fails = [];
  /** @type {string[]} */
  const errors = [];
  /** @type {string[]} */
  const notes = [];
  try {
    ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, reducedMotion: "reduce", locale: "en-GB", timezoneId: "UTC" });
    let at = Date.parse(space.store.now);
    await ctx.clock.setFixedTime(new Date(at));
    await ctx.addInitScript(probe, POLL_MS);
    const page = await ctx.newPage();
    page.setDefaultTimeout(8000);
    page.on("pageerror", (/** @type {Error} */ e) => errors.push(e.message));
    /** @type {Tools} */
    const t = {
      page, space, store: space.store,
      settle: (o) => settle(page, space, o),
      open: async (path = "/") => { await page.goto(space.base + path); return settle(page, space, { timeout: 15000 }); },
      snap: async (name, locator = page.locator("body")) => {
        const file = join(DIR, "snapshots", c.file, `${slug(c.name)}--${slug(name)}.aria.yml`);
        used.add(file);
        const r = await compareAria(locator, file, { update: UPDATE });
        if (r.written) notes.push(`wrote ${file.slice(ROOT.length + 1)}`);
        if (!r.ok) fails.push(`snapshot "${name}" differs from ${file.slice(ROOT.length + 1)}:\n${r.diff}`);
      },
      fail: (msg) => fails.push(msg),
      tick: async (ms) => { at += ms; await ctx.clock.setFixedTime(new Date(at)); },
    };
    /** @type {NodeJS.Timeout | undefined} */
    let timer;
    await Promise.race([c.run(t), new Promise((_, no) => { timer = setTimeout(() => no(new Error(`the case took over ${CASE_MS} ms`)), CASE_MS); })]).finally(() => clearTimeout(timer));
    const drops = await page.evaluate(() => { const S = /** @type {any} */ (window).__e2e; S.checkDrops(); return S.drops; });
    if (drops.length) fails.push(`focus fell to the page when these went away: ${drops.join(", ")}`);
    for (const w of space.store.writes.filter((x) => x.unknown)) fails.push(`the page sent ${w.method} ${w.path}, which the seed doesn't answer`);
    for (const m of new Set(space.misses)) fails.push(`the page read ${m}, which the seed doesn't answer`);
  } catch (e) {
    fails.push(String(/** @type {any} */ (e).stack || e).split("\n").slice(0, 4).join("\n"));
  } finally {
    if (ctx) await ctx.close().catch(() => {});
    await space.close();
  }
  if (errors.length) fails.push(`page errors: ${errors.join(" | ")}`);
  for (const e of space.errors) fails.push(`the fake Space failed: ${e}`);
  return { fails, notes };
}

async function main() {
  const cases = await collect();
  if (!cases.length) { console.error(`not run: no case matches "${filter}"`); return 2; }
  const { pw, tried } = findPlaywright();
  if (!pw) { console.error(`not run: playwright-core isn't in ${tried.join(", ")}`); return 2; }
  const l = await launch(pw.chromium);
  if (!l.browser) { console.error(`not run: no Chromium starts (${l.why})`); return 2; }
  const browser = l.browser;
  let failed = 0, passed = 0, over = false;
  try {
    for (const c of cases) {
      if (Date.now() - t0 > BUDGET) { over = true; break; }
      const c0 = Date.now();
      const { fails, notes } = await runCase(browser, c);
      const ms = Date.now() - c0;
      if (fails.length) { failed++; console.log(`FAIL ${c.file} › ${c.name} (${ms} ms)`); for (const f of fails) console.log("  " + f.replace(/\n/g, "\n  ")); }
      else { passed++; console.log(`ok   ${c.file} › ${c.name} (${ms} ms)`); }
      for (const n of notes) console.log(`     ${n}`);
    }
  } finally { await browser.close().catch(() => {}); }
  if (Date.now() - t0 > BUDGET) over = true;
  let stale = 0;
  if (!filter && passed + failed === cases.length) for (const f of goldens().filter((x) => !used.has(x))) {
    if (UPDATE) { rmSync(f); console.log(`     removed ${f.slice(ROOT.length + 1)}, which no case uses`); }
    else { stale++; console.log(`FAIL ${f.slice(ROOT.length + 1)} is a golden no case uses (UPDATE=1 removes it)`); }
  }
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  if (over) console.log(`FAIL the run passed its budget of ${BUDGET / 1000} s; ${cases.length - passed - failed} case(s) not run`);
  console.log(`${passed} passed, ${failed} failed, ${secs} s (${l.how})`);
  return failed || over || stale ? 1 : 0;
}

main().then((code) => process.exit(code), (e) => { console.error(e); process.exit(1); });
