// The one check: `node tools/check.mjs` (everything) or `node tools/check.mjs --fast` (the pre-commit half).
//
// Steps, in order; the run fails on the first failing step (exit code 1), and says which:
//   1. lint     oxlint (.oxlintrc.json). Findings that existed when the baseline was made are allowed
//               (tools/baselines/lint.json); a NEW finding fails. Fixing old ones is welcome.
//   2. types    tsc --noEmit -p jsconfig.json: every file that starts with `// @ts-check` is type-checked.
//   3. ratchets file size and `!important`: a file may shrink, never grow past its recorded size; a new
//               source file may not pass NEW_FILE_MAX lines; a stylesheet's `!important` count may only fall
//               (tools/baselines/ratchets.json).
//   4. ledger   python3 tools/ledger/check_ledger.py: every file of the plan's base commit has a home.
//   5. tests    node tests/run.mjs: every unit test, by exit code (skipped by --fast).
//
//   --fast              steps 1–4 (seconds; the pre-commit hook runs this)
//   --update-baselines  lower the baselines to today's numbers where they fell; never raises one
//
// Browser suites never run here (the owner's rule: only when asked).
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdirSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const FAST = process.argv.includes("--fast");
const UPDATE = process.argv.includes("--update-baselines");
const BASE_DIR = join(ROOT, "tools/baselines");
const NEW_FILE_MAX = 400;
const SOURCE_DIRS = ["js", "css", "core", "shell", "modules", "apps-host"];
const SKIP = /(^|\/)(vendor|node_modules)\//;

const readJson = (p, d) => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : d);
const writeJson = (p, v) => { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, JSON.stringify(v, null, 1) + "\n"); };
const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { cwd: ROOT, encoding: "utf8", maxBuffer: 64 << 20, ...opts });
const bin = (name) => join(ROOT, "node_modules/.bin", name);

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
  const grown = Object.entries(now).filter(([k, n]) => n > (base[k] || 0));
  if (UPDATE) writeJson(basePath, Object.fromEntries(Object.entries(base).map(([k, n]) => [k, Math.min(n, now[k] || 0)]).filter(([, n]) => n > 0)));
  if (!grown.length) return null;
  const lines = diags.filter((d) => grown.some(([k]) => k === `${d.filename}::${d.code}`))
    .map((d) => `  ${d.filename}:${d.labels?.[0]?.span?.line ?? "?"}  ${d.code}  ${d.message}`);
  return `new lint findings (fix them; the baseline only allows what existed before):\n${lines.join("\n")}`;
});

step("types", () => {
  if (!existsSync(bin("tsc"))) return "tsc is not installed: run `npm ci`";
  const r = run(bin("tsc"), ["-p", "jsconfig.json"]);
  return r.status === 0 ? null : `type errors:\n${(r.stdout + r.stderr).trim()}`;
});

function sourceFiles() {
  const out = [];
  const walk = (dir) => {
    for (const n of readdirSync(join(ROOT, dir))) {
      const rel = `${dir}/${n}`;
      if (SKIP.test(rel + "/")) continue;
      const st = statSync(join(ROOT, rel));
      if (st.isDirectory()) walk(rel);
      else if (/\.(m?js|css)$/.test(n)) out.push(rel);
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

step("ledger", () => {
  const r = run("python3", ["tools/ledger/check_ledger.py", "--repo", "."]);
  return r.status === 0 ? null : `ledger:\n${(r.stdout + r.stderr).trim()}`;
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
