// node tools/openapi/snapshot.mjs [base]: one GET of xo-space's /openapi.json, kept as each path's methods for the route contract test.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const base = process.argv[2] || process.env.XO_API || "http://127.0.0.1:5002";
const res = await fetch(`${base.replace(/\/$/, "")}/openapi.json`);
if (!res.ok) { console.error(`${base}/openapi.json answered ${res.status}`); process.exit(1); }
const doc = await res.json();
const METHODS = ["get", "put", "post", "delete", "patch", "head"];
const paths = Object.fromEntries(Object.keys(doc.paths).sort().map((p) => [p, METHODS.filter((m) => m in doc.paths[p]).map((m) => m.toUpperCase())]));
const out = fileURLToPath(new URL("../../core/platform/tests/fixtures/openapi-routes.json", import.meta.url));
writeFileSync(out, JSON.stringify({ title: doc.info?.title, version: doc.info?.version, taken: new Date().toISOString().slice(0, 10), paths }, null, 1) + "\n");
console.log(`${Object.keys(paths).length} paths written to ${out}`);
