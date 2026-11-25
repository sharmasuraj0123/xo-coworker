import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { publicGraph } from "./graph.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const temporary = mkdtempSync(join(tmpdir(), "xo-build-"));
function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, { encoding: "utf8", cwd: root, maxBuffer: 64 << 20, ...options });
  if (result.status !== 0) throw new Error(result.error?.message ?? result.stderr + result.stdout);
  return result.stdout.trim();
}
try {
  copyFileSync(join(root, "serve.py"), join(temporary, "serve.py"));
  copyFileSync(join(root, "index.html"), join(temporary, "index.html"));
  function checkHttp(server, graph, mode, forceRaw = false) {
    console.log(run("python3", ["tools/build/check-http.py", server, mode], {
      env: { ...process.env, XO_SERVE_RAW: forceRaw ? "1" : "" }, input: JSON.stringify([...graph]),
    }));
  }
  checkHttp(temporary, [], "raw");
  const build = run(process.execPath, ["tools/build-ui.mjs", join(temporary, "dist")]);
  const resolve = path => run(process.execPath, ["tools/conformance/css-resolve.mjs", "--resolved", path]);
  assert.ok(resolve(root) === resolve(build), "Production styles changed the resolved cascade");
  const source = publicGraph(root);
  const bundled = publicGraph(build, true);
  for (const asset of source) {
    if (asset.startsWith("vendor/") || !/\.(?:m?js|css)$/.test(asset)) bundled.add(asset);
  }
  checkHttp(root, source, "raw", true);
  checkHttp(temporary, bundled, "production");
  run("python3", ["tools/build/check-releases.py"]);
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
