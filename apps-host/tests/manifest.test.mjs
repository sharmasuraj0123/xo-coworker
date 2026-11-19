import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { checkManifest, SURFACE_PLACES, permissionWords, globRe } from "../manifest.js";
import { PLACES } from "../../shell/places.js";

const WORD = JSON.parse(readFileSync(new URL("./fixtures/word.plugin.json", import.meta.url), "utf8"));
const clone = () => structuredClone(WORD);
const x = (/** @type {any} */ p) => p.extensions["space.xo"];

for (const [kind, place] of Object.entries(SURFACE_PLACES)) {
  const def = PLACES.find((p) => p.id === place);
  assert.ok(def, `${kind} → ${place} exists`);
  assert.equal(def.openToApps, true, `${place} is open to apps`);
}

const { app, problems } = checkManifest(WORD);
assert.deepEqual(problems, []);
assert.ok(app);
assert.equal(app.id, "dev.example.word");
assert.equal(app.routes.length, 3);
assert.equal(app.settings.length, 2);
assert.deepEqual(Object.keys(app.surfaces).sort(), ["canvas", "commands", "evidence", "header", "inline", "panel"]);
assert.equal(app.tools.agent_only.visibility.join(), "model");
assert.equal(app.surfaces.inline[0].maxHeight, 240);
assert.equal(permissionWords(app.permissions.required[0]), "Read files in docs/**, **/*.word.json");
assert.ok(globRe("**/*.word.json").test("a/b/c.word.json"));
assert.ok(globRe("**/*.word.json").test("c.word.json"));
assert.ok(!globRe("docs/*.word.json").test("docs/a/b.word.json"));

/** @param {(p: any) => void} edit @param {RegExp} why */
const refused = (edit, why) => {
  const p = clone();
  edit(p);
  const r = checkManifest(p);
  assert.equal(r.app, null, `refused: ${why}`);
  assert.ok(r.problems.some((m) => why.test(m)), `${why} in ${JSON.stringify(r.problems)}`);
};
refused((p) => { delete p.extensions; }, /no extensions/);
refused((p) => { x(p).id = "Word"; }, /reverse-DNS/);
refused((p) => { p.version = "1"; }, /semver/);
refused((p) => { x(p).engines.xo = ">=1.0 <2"; }, /needs XO apps contract/);
refused((p) => { x(p).routes.push("GET /api/secrets/env"); }, /never opens/);
refused((p) => { x(p).routes.push("POST /api/files/save"); }, /never opens/);
refused((p) => { x(p).routes.push("PUT /api/apps/{id}/grants"); }, /never opens/);
refused((p) => { x(p).surfaces.panel[0].view = "ui://other.app/x"; }, /one of its own/);
refused((p) => { x(p).surfaces.panel[0].view = "https://evil.example/x"; }, /one of its own/);
refused((p) => { x(p).permissions.required[0].paths = [".env"]; }, /never \.git/);
refused((p) => { x(p).permissions.required[0].paths = ["../x/**"]; }, /never \.git/);
refused((p) => { x(p).permissions.required[0].paths = [".git/**"]; }, /never \.git/);
refused((p) => { x(p).permissions.required[0].paths = ["/etc/passwd"]; }, /never \.git/);
refused((p) => { x(p).permissions.required.push({ cap: "inference", why: "x" }); }, /isn't a permission/);
refused((p) => { x(p).permissions.required.push({ cap: "terminal", why: "x" }); }, /isn't a permission/);
refused((p) => { x(p).permissions.required[0].why = ""; }, /say why/);
refused((p) => { x(p).documents[0].pattern = "**/*.md"; }, /own file type/);
refused((p) => { x(p).documents[0].pattern = "**/*"; }, /own file type/);
refused((p) => { x(p).surfaces.header[0].opens = "nope"; }, /isn't one of its panel/);
refused((p) => { x(p).surfaces.home = []; }, /isn't a place apps can use/);
refused((p) => { x(p).surfaces.commands[0].run = { tool: "agent_only" }; }, /"app" visibility/);
refused((p) => { x(p).surfaces.commands[0].run = { tool: "word_create", prompt: "x" }; }, /one tool or one prompt/);
refused((p) => { x(p).surfaces.commands[0].slash = "/Bad Slash"; }, /slash/);
refused((p) => { x(p).surfaces.panel[0].when = "eval('x')"; }, /must look like/);
refused((p) => { x(p).surfaces.canvas[0].for = "sheet"; }, /"for" must name/);
refused((p) => { x(p).surfaces.panel.push({ ...x(p).surfaces.panel[0] }); }, /its own short id/);
refused((p) => { x(p).surfaces.settings.push({ name: "s", label: "S", type: "html" }); }, /needs a label and a type/);
refused((p) => { x(p).permissions.optional.push({ cap: "network", hosts: ["127.0.0.1"], why: "x" }); }, /hosts must be named/);
refused((p) => { x(p).tools.word_create.risk = "low"; }, /risk is/);
console.log("ok manifest: the Word fixture passes; every unsafe or unknown field is refused in plain words");
