import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdirSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { checkLifecycle } from "./lifecycle.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url))), FAST = process.argv.includes("--fast");
const UPDATE = process.argv.includes("--update-baselines");
const UPSTREAM = process.argv.includes("--accept-upstream") ? process.argv[process.argv.indexOf("--accept-upstream") + 1] : null;
const BASE_DIR = join(ROOT, "tools/baselines");
const NEW_FILE_MAX = 400;
const SOURCE_DIRS = ["js", "css", "core", "shell", "modules", "apps-host"];
const SKIP = /(^|\/)(vendor|node_modules)\//;

const readJson = (p, d) => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : d);
const writeJson = (p, v) => { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, JSON.stringify(v, null, 1) + "\n"); };
const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { cwd: ROOT, encoding: "utf8", maxBuffer: 64 << 20, ...opts });
const bin = (name) => join(ROOT, "node_modules/.bin", name);

const upstreamSame = (() => {
  if (!UPSTREAM) return () => false;
  const r = run("git", ["diff", "--name-only", UPSTREAM, "--"]);
  if (r.status !== 0) throw new Error(`--accept-upstream: unknown ref ${UPSTREAM}`);
  const ours = new Set(r.stdout.split("\n").filter(Boolean));
  const theirs = new Set(run("git", ["ls-tree", "-r", "--name-only", UPSTREAM]).stdout.split("\n"));
  return (/** @type {string} */ f) => theirs.has(f) && !ours.has(f);
})();

const steps = [];
function step(name, fn) { steps.push({ name, fn }); }

step("lint", () => {
  if (!existsSync(bin("oxlint"))) return "oxlint is not installed: run `npm ci` (dev-only tools, see AGENTS.md)";
  const r = run(bin("oxlint"), ["-c", ".oxlintrc.json", "--format", "json", "."]);
  let diags;
  try { diags = JSON.parse(r.stdout).diagnostics; } catch { return `oxlint gave no JSON:\n${r.stderr || r.stdout}`; }
  const now = {};
  for (const d of diags) { const k = `${d.filename}::${d.code}`; now[k] = (now[k] || 0) + 1; }
  const basePath = join(BASE_DIR, "lint.json");
  const base = readJson(basePath, null);
  if (!base) { writeJson(basePath, now); return null; }
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
  const basePath = join(BASE_DIR, "ratchets.json");
  const now = { lines: {}, important: {} };
  for (const f of sourceFiles()) {
    const text = readFileSync(join(ROOT, f), "utf8");
    const lines = text.split("\n").length - (text.endsWith("\n") ? 1 : 0);
    if (lines > NEW_FILE_MAX) now.lines[f] = lines;
    if (f.endsWith(".css")) { const n = (text.match(/!important/g) || []).length; if (n) now.important[f] = n; }
  }
  const base = readJson(basePath, null);
  if (!base) { writeJson(basePath, now); return null; }
  if (UPSTREAM) {
    for (const [f, n] of Object.entries(now.lines)) if (upstreamSame(f)) base.lines[f] = Math.max(base.lines[f] || 0, n);
    for (const [f, n] of Object.entries(now.important)) if (upstreamSame(f)) base.important[f] = Math.max(base.important[f] || 0, n);
    writeJson(basePath, base);
  }
  const errs = [];
  for (const [f, n] of Object.entries(now.lines)) {
    if (base.lines[f] === undefined) errs.push(`  ${f}: ${n} lines; a new or small file may not pass ${NEW_FILE_MAX} (split it)`);
    else if (n > base.lines[f]) errs.push(`  ${f}: ${n} lines, was ${base.lines[f]}; it may shrink, never grow`);
  }
  for (const [f, n] of Object.entries(now.important)) {
    if (n > (base.important[f] || 0)) errs.push(`  ${f}: ${n} !important, was ${base.important[f] || 0}; use @layer order instead`);
  }
  if (UPDATE) writeJson(basePath, {
    lines: Object.fromEntries(Object.entries(base.lines).filter(([f]) => now.lines[f] !== undefined).map(([f, n]) => [f, Math.min(n, now.lines[f])])),
    important: Object.fromEntries(Object.entries(base.important).filter(([f]) => now.important[f]).map(([f, n]) => [f, Math.min(n, now.important[f])])),
  });
  return errs.length ? `ratchets:\n${errs.join("\n")}` : null;
});

const REF = /(PLAN\.md|WAVES\.md|architecture\/|design-research\/|decision note|\bphase [0-9]|\bD[0-9]\b)/i;
function commentFiles() {
  const out = sourceFiles();
  const walk = (dir, re) => {
    if (!existsSync(join(ROOT, dir))) return;
    for (const n of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${n.name}`;
      if (SKIP.test(rel + "/") || n.name === "baselines") continue;
      if (n.isDirectory()) walk(rel, re); else if (re.test(n.name)) out.push(rel);
    }
  };
  walk("tests", /\.(m?js|cjs|py)$/);
  walk("tools", /\.(m?js|cjs|py)$/);
  walk("e2e", /\.(m?js|cjs)$/);
  for (const f of ["serve.py", "index.html"]) if (existsSync(join(ROOT, f))) out.push(f);
  return [...new Set(out)];
}
/** @param {string} f @param {string} text */
function commentStats(f, text) {
  const py = f.endsWith(".py");
  let extra = 0, refs = 0, run = 0, inBlock = false, inDoc = false;
  for (const line of text.split("\n")) {
    const t = line.trim();
    let isComment;
    if (py) {
      if (inDoc) { isComment = true; if (t.includes('"""')) inDoc = false; }
      else if (t.startsWith('"""') && !(t.length > 3 && t.endsWith('"""'))) { isComment = true; inDoc = true; }
      else isComment = t.startsWith("#") && !t.startsWith("#!");
    } else if (inBlock) { isComment = true; if (t.includes("*/")) inBlock = false; }
    else if (t.startsWith("/*") || t.startsWith("<!--")) { isComment = true; inBlock = !t.includes("*/") && !t.includes("-->"); }
    else isComment = t.startsWith("//");
    if (isComment) { run++; if (run > 1) extra++; } else run = 0;
    if ((isComment || /\s\/\/\s|#\s/.test(line)) && REF.test(line)) refs++;
  }
  return { extra, refs };
}

step("comments", () => {
  const basePath = join(BASE_DIR, "comments.json");
  const now = {};
  for (const f of commentFiles()) {
    const s = commentStats(f, readFileSync(join(ROOT, f), "utf8"));
    if (s.extra || s.refs) now[f] = s;
  }
  const base = readJson(basePath, null);
  if (!base) { writeJson(basePath, now); return null; }
  if (UPSTREAM) {
    for (const [f, st] of Object.entries(now)) if (upstreamSame(f)) base[f] = { extra: Math.max(base[f]?.extra || 0, st.extra), refs: Math.max(base[f]?.refs || 0, st.refs) };
    writeJson(basePath, base);
  }
  const errs = [];
  for (const [f, s] of Object.entries(now)) {
    const b = base[f] || { extra: 0, refs: 0 };
    if (s.extra > b.extra) errs.push(`  ${f}: ${s.extra} comment lines past the first of a comment, was ${b.extra}; one line at most`);
    if (s.refs > b.refs) errs.push(`  ${f}: ${s.refs} comments point at plan docs, phases or decisions, was ${b.refs}; none allowed`);
  }
  if (UPDATE) writeJson(basePath, Object.fromEntries(Object.entries(base).filter(([f]) => now[f]).map(([f, b]) => [f, { extra: Math.min(b.extra, now[f].extra), refs: Math.min(b.refs, now[f].refs) }])));
  return errs.length ? `comments:\n${errs.join("\n")}` : null;
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
      if (/(^|\/)(vendor|node_modules)\//.test(target) || target.startsWith("js/vendor/")) continue;
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

step("lifecycle", () => checkLifecycle(sourceFiles(), ROOT, join(BASE_DIR, "lifecycle.json"), UPDATE));
step("places", () => {
  const r = run(process.execPath, ["tools/places-md.mjs", "--check"]);
  return r.status === 0 ? null : (r.stderr || r.stdout).trim();
});

step("ledger", () => {
  const r = run("python3", ["tools/ledger/check_ledger.py", "--repo", "."]);
  if (r.status !== 0) return `ledger:\n${(r.stdout + r.stderr).trim()}`;
  const md = run("python3", ["tools/ledger/ledger_md.py", ".", "--check"]);
  return md.status === 0 ? null : (md.stdout + md.stderr).trim();
});

if (!FAST) step("tests", () => {
  const r = run(process.execPath, ["tests/run.mjs"], { stdio: ["ignore", "pipe", "pipe"] });
  const tail = (r.stdout + r.stderr).trim().split("\n").slice(-60).join("\n");
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
