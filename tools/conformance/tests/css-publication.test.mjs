// @ts-check

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { ORIGIN, PUBLISHED_PATH, publishedLink, sourcePath } from "../css-publication.mjs";

const EXPORT_POLICY = `
import json, runpy, sys
server = runpy.run_path(sys.argv[1])
print(json.dumps([server["STATIC_PATH"], server["INDEX_PATH"].pattern, server["VERSION_PATH"].pattern]))
`;
const server = fileURLToPath(new URL("../../../serve.py", import.meta.url));

/** @param {string} path @param {string[]} policy */
function assertPublicationParity(path, policy) {
  assert.deepEqual(policy, [
    path,
    String.raw`((?:href|src)=")\./(${path})(?=")`,
    String.raw`^/v/([0-9a-f]{12})(/(?:${path}))$`,
  ], "Stylesheet and server publication policies differ");
}

test("stylesheet publication uses the exact server path grammar and catches a directory added on one side", () => {
  const result = spawnSync("python3", ["-B", "-c", EXPORT_POLICY, server], {
    encoding: "utf8", env: { ...process.env, XO_SERVE_RAW: "1" },
  });
  assert.equal(result.status, 0, result.error?.message ?? result.stderr);
  const policy = JSON.parse(result.stdout);
  assertPublicationParity(PUBLISHED_PATH, policy);
  const drifted = PUBLISHED_PATH.replace("|vendor", "");
  assert.throws(() => assertPublicationParity(drifted, policy), /publication policies differ/);
});

test("published links preserve the version boundary and map back to their source", () => {
  const entry = new URL("/index.html", ORIGIN);
  const published = publishedLink("./css/app.css", entry);
  assert.match(published.pathname, /^\/v\/[^/]+\/css\/app\.css$/);
  assert.equal(sourcePath(published), "/css/app.css");
  assert.equal(publishedLink("/css/app.css", entry).pathname, "/css/app.css");
  assert.equal(publishedLink("./css/", entry).pathname, "/css/");
  assert.throws(() => sourcePath(new URL("../outside/app.css", published)), /outside the published version tree/);
});
