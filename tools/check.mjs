import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdirSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { importEffects } from "./conformance/app-wiring.mjs";
import { javascript, TEST } from "./conformance/syntax.mjs";
import { checkConformance } from "./conformance/ratchet.mjs";
import { sizeSignals, sizeRatchet } from "./conformance/size-ratchet.mjs";
import { runGit } from "./git-environment.mjs";
import { parseArgs } from "node:util";

const { values: flags } = parseArgs({ options: {
  fast: { type: "boolean" }, "update-baselines": { type: "boolean" },
  "accept-upstream": { type: "string" }, "conformance-base": { type: "string" },
} });
const ROOT = dirname(dirname(fileURLToPath(import.meta.url))), FAST = flags.fast;
const UPDATE = flags["update-baselines"], UPSTREAM = flags["accept-upstream"];
const BASE_DIR = join(ROOT, "tools/baselines");
const SOURCE_DIRS = ["js", "css", "core", "shell", "modules", "apps-host"];
const SKIP = /(^|\/)(vendor|node_modules)\//;

const readJson = (p, d) => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : d);
const writeJson = (p, v) => { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, JSON.stringify(v, null, 1) + "\n"); };
const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { cwd: ROOT, encoding: "utf8", maxBuffer: 64 << 20, ...opts });
const bin = (name) => join(ROOT, "node_modules/.bin", name);

const upstreamSame = (() => {
  if (!UPSTREAM) return () => false;
  const r = runGit(["diff", "--name-only", UPSTREAM, "--"], { cwd: ROOT, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`--accept-upstream: unknown ref ${UPSTREAM}`);
  const ours = new Set(r.stdout.split("\n").filter(Boolean));
  const theirs = new Set(runGit(["ls-tree", "-r", "--name-only", UPSTREAM], { cwd: ROOT, encoding: "utf8" }).stdout.split("\n"));
  return (/** @type {string} */ f) => theirs.has(f) && !ours.has(f);
})();

const steps = [];
function step(name, fn) { steps.push({ name, fn }); }

step("lint", () => {
  if (!existsSync(bin("oxlint"))) return "oxlint is not installed: run `npm ci` (dev-only tools, see AGENTS.md)";
  const r = run(bin("oxlint"), ["-c", ".oxlintrc.json", "--format", "json", "."]);
  if (![0, 1].includes(r.status)) return `oxlint did not complete: ${r.error?.message ?? r.stderr}`;
  let diags;
  try { diags = JSON.parse(r.stdout).diagnostics; } catch { return `oxlint gave no JSON:\n${r.stderr || r.stdout}`; }
  const now = {};
  for (const d of diags) { const k = `${d.filename}::${d.code}`; now[k] = (now[k] || 0) + 1; }
  const basePath = join(BASE_DIR, "lint.json");
  const base = readJson(basePath, null);
  if (!base) return "Missing lint baseline";
  if (UPSTREAM) { for (const [k, n] of Object.entries(now)) if (upstreamSame(k.split("::")[0])) base[k] = Math.max(base[k] || 0, n); writeJson(basePath, base); }
  const grown = Object.entries(now).filter(([k, n]) => n > (base[k] || 0));
  if (UPDATE) writeJson(basePath, Object.fromEntries(Object.entries(base).map(([k, n]) => [k, Math.min(n, now[k] || 0)]).filter(([, n]) => n > 0)));
  if (!grown.length) return null;
  const lines = diags.filter((d) => grown.some(([k]) => k === `${d.filename}::${d.code}`))
    .map((d) => `  ${d.filename}:${d.labels?.[0]?.span?.line ?? "?"}  ${d.code}  ${d.message}`);
  return `new lint findings (fix them; the baseline only allows what existed before):\n${lines.join("\n")}`;
});

if (!FAST) step("types", () => {
  if (!existsSync(bin("tsc"))) return "tsc is not installed: run `npm ci`";
  for (const project of ["jsconfig.json", "e2e/jsconfig.json"]) {
    const r = run(bin("tsc"), ["-p", project]);
    if (r.status !== 0) return `type errors (${project}):\n${(r.stdout + r.stderr).trim()}`;
  }
  return null;
});

function sourceFiles() {
  const out = [];
  const walk = (dir) => {
    for (const n of readdirSync(join(ROOT, dir))) {
      const rel = `${dir}/${n}`;
      if (SKIP.test(rel + "/")) continue;
      const st = statSync(join(ROOT, rel));
      if (st.isDirectory()) walk(rel);
      else if (/\.(m?js|d\.ts|css)$/.test(n)) out.push(rel);
    }
  };
  for (const d of SOURCE_DIRS) if (existsSync(join(ROOT, d))) walk(d);
  if (existsSync(join(ROOT, "boot.js"))) out.push("boot.js");
  return out;
}

step("ratchets", () => {
  for (const file of sizeSignals(ROOT)) console.log(`  size review: ${file}`);
  const basePath = join(BASE_DIR, "ratchets.json");
  const now = { lines: {}, important: {} };
  for (const f of sourceFiles()) {
    const text = readFileSync(join(ROOT, f), "utf8");
    if (f.endsWith(".css")) { const n = (text.match(/!important/g) || []).length; if (n) now.important[f] = n; }
  }
  const base = readJson(basePath, null);
  if (!base) { writeJson(basePath, now); return null; }
  if (UPSTREAM) {
    for (const [f, n] of Object.entries(now.lines)) if (upstreamSame(f)) base.lines[f] = Math.max(base.lines[f] || 0, n);
    for (const [f, n] of Object.entries(now.important)) if (upstreamSame(f)) base.important[f] = Math.max(base.important[f] || 0, n);
    writeJson(basePath, base);
  }
  if (flags["conformance-base"] && !UPSTREAM) {
    const ref = `${flags["conformance-base"]}:tools/baselines/ratchets.json`;
    const previous = runGit(["show", "--end-of-options", ref], { cwd: ROOT, encoding: "utf8" });
    if (previous.status !== 0) return `Cannot read ratchets at ${flags["conformance-base"]}`;
    const { growth } = sizeRatchet(base, JSON.parse(previous.stdout));
    if (growth.length) return `Ratchet allowances grew.\n${growth.join("\n")}`;
  }
  const { growth, stale } = sizeRatchet(now, base);
  if (growth.length) return growth.join("\n");
  if (UPDATE && stale.length) writeJson(basePath, now);
  if (!UPDATE && stale.length) return `Run --update-baselines to tighten the ratchet.\n${stale.join("\n")}`;
  return null;
});

const RANK = [["core/kernel/", 0], ["core/platform/", 1], ["core/ui/", 2], ["core/services/", 3], ["shell/", 4], ["modules/", 5], ["apps-host/", 6], ["js/", 7], ["boot.js", 8]];
const rankOf = (/** @type {string} */ f) => RANK.find(([p]) => f.startsWith(p))?.[1] ?? -1;
const moduleOf = (/** @type {string} */ f) => (f.startsWith("modules/") ? f.split("/")[1] : null);
function* importSpecifiers(text) {
  for (const [, from, inline] of text.matchAll(/(?:^|\n)\s*(?:import|export)\s[^"'`;]*?\bfrom\s*["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g)) yield from || inline;
  for (const [doc] of text.matchAll(/^\s*\/\*\*[\s\S]*?\*\//gm)) {
    for (const [, from] of doc.matchAll(/@import\s+[^"'@]*?\bfrom\s*["']([^"']+)["']/g)) yield from;
  }
}

function layerViolations() {
  const out = {};
  for (const f of sourceFiles().filter((x) => /\.(m?js|d\.ts)$/.test(x) && rankOf(x) >= 0 && rankOf(x) < 7)) {
    const text = readFileSync(join(ROOT, f), "utf8");
    for (const spec of importSpecifiers(text)) {
      if (!spec.startsWith(".")) continue;
      const target = relative(ROOT, join(ROOT, dirname(f), spec)).replace(/\\/g, "/");
      if (/(^|\/)(vendor|node_modules)\//.test(target)) continue;
      const testOfLegacy = /(^|\/)tests\//.test(f) && target.startsWith("js/");
      const up = rankOf(target) > rankOf(f) && !testOfLegacy;
      const across = moduleOf(f) && moduleOf(target) && moduleOf(f) !== moduleOf(target);
      if (up || across) out[`${f} -> ${target}`] = 1;
    }
  }
  return out;
}

step("layers", () => {
  const basePath = join(BASE_DIR, "layers.json");
  const now = layerViolations();
  const base = readJson(basePath, null);
  if (!base) { writeJson(basePath, now); return null; }
  const fresh = Object.keys(now).filter((k) => !base[k]);
  if (UPDATE) writeJson(basePath, Object.fromEntries(Object.keys(base).filter((k) => now[k]).map((k) => [k, 1])));
  return fresh.length ? `layers: a file imports upward or from another module (talk through services, places or the bus):\n${fresh.map((k) => `  ${k}`).join("\n")}` : null;
});

step("import lifetimes", () => {
  const errors = [];
  for (const file of sourceFiles()) {
    if (!/^(?:core|modules|shell)\/.*\.m?js$/.test(file) || TEST.test(file)) continue;
    const source = readFileSync(join(ROOT, file), "utf8");
    importEffects(file, javascript(source, file).tree, (_, line) => errors.push(`${file}:${line}: move startup effects into activation`));
  }
  return errors.length ? errors.join("\n") : null;
});

step("conformance", () => checkConformance(ROOT, BASE_DIR, { update: UPDATE, base: flags["conformance-base"] }));
step("places", () => {
  const r = run(process.execPath, ["tools/places-md.mjs", "--check"]);
  return r.status === 0 ? null : (r.stderr || r.stdout).trim();
});

if (!FAST) step("production build", () => {
  const result = run(process.execPath, ["tools/build/check.mjs"]);
  return result.status === 0 ? null : (result.stderr || result.stdout).trim();
});

if (!FAST) step("tests", () => {
  const r = run(process.execPath, ["tests/run.mjs"], { stdio: ["ignore", "pipe", "pipe"] });
  const output = (r.stdout + r.stderr).trim().split("\n");
  const tail = [...output.filter(line => line.startsWith("FAIL ")), ...output.slice(-60)].join("\n");
  return r.status === 0 ? null : `tests:\n${tail}`;
});

const t0 = Date.now();
for (const s of steps) {
  const t = Date.now();
  let err;
  try { err = s.fn(); } catch (e) { err = String(e?.stack || e); }
  const ms = Date.now() - t;
  if (err) {
    console.error(`FAIL ${s.name} (${(ms / 1000).toFixed(1)} s)\n${err}`);
    console.error(`\ncheck failed at "${s.name}" after ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    process.exit(1);
  }
  console.log(`ok   ${s.name} (${(ms / 1000).toFixed(1)} s)`);
}
console.log(`\ncheck passed${FAST ? " (fast: tests not run)" : ""} in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
