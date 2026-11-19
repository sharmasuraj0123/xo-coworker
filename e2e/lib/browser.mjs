// @ts-check

// Finds playwright-core (PLAYWRIGHT_CORE), Chromium (CHROMIUM_PATH) and, if needed, its libraries (E2E_LIBS).

import { createRequire } from "node:module";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const require = createRequire(import.meta.url);

/** playwright-core, or null with the places tried. */
export function findPlaywright() {
  const tried = [process.env.PLAYWRIGHT_CORE, join(homedir(), ".cache/xo-test-deps/node_modules/playwright-core"), "/tmp/pw/node_modules/playwright-core"].filter(Boolean);
  for (const p of tried) {
    if (!existsSync(join(/** @type {string} */ (p), "package.json"))) continue;
    try { return { pw: require(/** @type {string} */ (p)), from: p, tried }; } catch { /* next */ }
  }
  return { pw: null, from: null, tried };
}

/** Downloaded headless shells, newest first. */
function shells() {
  const d = join(homedir(), ".cache/ms-playwright");
  try {
    return readdirSync(d).filter((x) => x.startsWith("chromium_headless_shell-")).sort().reverse()
      .map((x) => join(d, x, "chrome-headless-shell-linux64/chrome-headless-shell")).filter((f) => existsSync(f));
  } catch { return []; }
}

/** @param {any} chromium @returns {Promise<{browser: any, how: string, why?: undefined} | {browser: null, how?: undefined, why: string}>} */
export async function launch(chromium) {
  const libs = process.env.E2E_LIBS || join(homedir(), ".cache/chromelibs/root/usr/lib/x86_64-linux-gnu"); // user-local libs on machines without them installed
  const env = existsSync(libs) ? { ...process.env, LD_LIBRARY_PATH: [libs, process.env.LD_LIBRARY_PATH].filter(Boolean).join(":") } : undefined;
  const tries = process.env.CHROMIUM_PATH ? [process.env.CHROMIUM_PATH] : [...shells(), null];
  const why = [];
  for (const exe of tries) {
    try {
      const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), ...(env ? { env } : {}), args: ["--disable-gpu", "--disable-dev-shm-usage", "--force-device-scale-factor=1"] });
      return { browser, how: `${exe || "playwright's chromium"}${env ? ` with ${libs}` : ""}` };
    } catch (e) { why.push(`${exe || "playwright's chromium"}: ${String(/** @type {any} */ (e).message).split("\n")[0]}`); }
  }
  return { browser: null, why: why.join(" | ") };
}
