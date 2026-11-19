// One command for every unit test: `node tests/run.mjs [filter]`.
//
// Runs each tests/*.test.mjs (and tests/*.test.py with python3) in its own process, a few at a time,
// and fails when ANY of them exits non-zero. The exit code is the verdict, never the words a test
// prints: a file can print "N passed" and still fail (our memory note, 2026-11). Browser suites
// (tests/browser/, later e2e/) are not run here: they run only when the owner asks.
//
//   node tests/run.mjs              every test
//   node tests/run.mjs files        only tests whose file name contains "files"
//   JOBS=8 node tests/run.mjs       more at once (default 4)
//   TEST_TIMEOUT_MS=120000          per-file limit (default 120 s); a timeout is a failure
//
// Known failures are listed in tests/known-failures.json with a reason each: they are reported, and
// they fail the run only when they start passing (so the list can never go stale) or when a new one
// appears.
import { spawn } from "node:child_process";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(DIR);
const filter = process.argv[2] || "";
const JOBS = Math.max(1, Number(process.env.JOBS) || 4);
const TIMEOUT = Math.max(1000, Number(process.env.TEST_TIMEOUT_MS) || 120_000);
const KNOWN_PATH = join(DIR, "known-failures.json");
const known = existsSync(KNOWN_PATH) ? JSON.parse(readFileSync(KNOWN_PATH, "utf8")) : {};

const files = readdirSync(DIR)
  .filter((f) => /\.test\.(mjs|py)$/.test(f) && f.includes(filter))
  .sort();

/** Run one test file; resolve {file, code, ms, out}. */
function runOne(file) {
  const t0 = Date.now();
  const [cmd, args] = file.endsWith(".py") ? ["python3", [join(DIR, file)]] : [process.execPath, [join(DIR, file)]];
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
