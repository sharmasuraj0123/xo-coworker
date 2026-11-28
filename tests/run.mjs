// node tests/run.mjs [filter]: every unit test, judged by exit code (JOBS, TEST_TIMEOUT_MS).
import { spawn } from "node:child_process";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(DIR);
const filter = process.argv[2] || "";
const JOBS = Math.max(1, Number(process.env.JOBS) || 2);
const TIMEOUT = Math.max(1000, Number(process.env.TEST_TIMEOUT_MS) || 120_000);
const KNOWN_PATH = join(DIR, "known-failures.json");
const known = existsSync(KNOWN_PATH) ? JSON.parse(readFileSync(KNOWN_PATH, "utf8")) : {};

const IS_TEST = /\.test\.(mjs|py)$/;
const files = readdirSync(DIR).filter((f) => IS_TEST.test(f));
/** @param {string} rel @param {(path: string) => void} visit */
function walk(rel, visit) {
  for (const n of readdirSync(join(ROOT, rel), { withFileTypes: true })) {
    if (n.name === "node_modules" || n.name === "vendor" || n.name === ".git" || n.name === ".xo") continue;
    const p = rel ? `${rel}/${n.name}` : n.name;
    if (n.isDirectory()) walk(p, visit);
    else visit(p);
  }
}
for (const d of ["core", "shell", "modules", "apps-host", "e2e", "tools"]) {
  if (existsSync(join(ROOT, d))) walk(d, (p) => { if (/(^|\/)tests\/[^/]+$/.test(p) && IS_TEST.test(p)) files.push(p); });
}
if (!filter) {
  const discovered = new Set(files.map((f) => f.includes("/") ? f : `tests/${f}`));
  const missing = [];
  walk("", (p) => { if (IS_TEST.test(p) && !discovered.has(p)) missing.push(p); });
  if (missing.length) {
    console.error(`Undiscovered unit tests:\n${missing.sort().join("\n")}`);
    process.exit(1);
  }
}
files.splice(0, files.length, ...files.filter((f) => f.includes(filter)).sort());

function runOne(file) {
  const t0 = Date.now();
  const path = file.includes("/") ? join(ROOT, file) : join(DIR, file);
  const [cmd, args] = file.endsWith(".py") ? ["python3", [path]] : [process.execPath, [path]];
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: ROOT, env: { ...process.env, FORCE_COLOR: "0" }, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    const keep = (b) => { out += b; if (out.length > 20000) out = out.slice(-20000); };
    child.stdout.on("data", keep);
    child.stderr.on("data", keep);
    const timer = setTimeout(() => { out += `\n[run.mjs] timed out after ${TIMEOUT} ms`; child.kill("SIGKILL"); }, TIMEOUT);
    child.on("close", (code, signal) => { clearTimeout(timer); resolve({ file, code: code ?? (signal ? 1 : 0), ms: Date.now() - t0, out }); });
    child.on("error", (e) => { clearTimeout(timer); resolve({ file, code: 1, ms: Date.now() - t0, out: String(e) }); });
  });
}

const results = [];
let next = 0;
async function worker() {
  while (next < files.length) {
    const f = files[next++];
    const r = await runOne(f);
    results.push(r);
    const tag = r.code === 0 ? "ok  " : known[f] ? "KNOWN" : "FAIL";
    console.log(`${tag} ${f} (${(r.ms / 1000).toFixed(1)} s)`);
  }
}
const t0 = Date.now();
await Promise.all(Array.from({ length: Math.min(JOBS, files.length) }, worker));

const failed = results.filter((r) => r.code !== 0 && !known[r.file]);
const fixedKnown = results.filter((r) => r.code === 0 && known[r.file]);
const knownStill = results.filter((r) => r.code !== 0 && known[r.file]);
for (const r of failed) console.log(`\n── ${r.file} (exit ${r.code}) ──\n${r.out.trim().split("\n").slice(-40).join("\n")}`);
console.log(`\n${results.length} files in ${((Date.now() - t0) / 1000).toFixed(1)} s: ${results.length - failed.length - knownStill.length} passed, ${failed.length} failed, ${knownStill.length} known failures.`);
for (const r of knownStill) console.log(`  known: ${r.file} — ${known[r.file]}`);
for (const r of fixedKnown) console.log(`  now passing, remove it from tests/known-failures.json: ${r.file}`);
if (!files.length) { console.log("no test matched"); process.exitCode = 1; }
if (failed.length || fixedKnown.length) process.exitCode = 1;
