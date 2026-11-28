import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { checkManifest, SURFACE_PLACES, permissionWords, globRe } from "../manifest.js";
import { PLACES } from "../../shell/places.js";

const WORD = JSON.parse(readFileSync(new URL("./fixtures/word.plugin.json", import.meta.url), "utf8"));
const clone = () => structuredClone(WORD);
const x = (/** @type {any} */ p) => p.extensions["space.xo"];
const sf = (/** @type {any} */ p, /** @type {string} */ id) => x(p).surfaces.find((/** @type {any} */ s) => s.id === id);

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
const sneaky = clone();
x(sneaky).permissions.optional[0].askWhen = "context.update; x";
assert.equal(checkManifest(sneaky).app?.permissions.optional[0].askWhen, undefined, "askWhen is a plain key or nothing");
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
refused((p) => { x(p).id = "xo.files"; }, /belong to XO/);
refused((p) => { x(p).id = "space.xo.word"; }, /belong to XO/);
refused((p) => { x(p).documents[0].pattern = "**/*.diff"; }, /own file type/);
refused((p) => { p.version = "1"; }, /semver/);
refused((p) => { x(p).engines["xo-space"] = ">=1.0 <2"; }, /needs XO apps contract/);
refused((p) => { x(p).engines.xo = "^2"; }, /needs XO kernel/);
refused((p) => { delete x(p).engines["xo-space"]; }, /apps contract range/);
refused((p) => { x(p).routes.push("GET /api/secrets/env"); }, /never opens/);
refused((p) => { x(p).routes.push("POST /api/files/save"); }, /never opens/);
refused((p) => { x(p).routes.push("PUT /api/apps/{id}/grants"); }, /never opens/);
refused((p) => { sf(p, "outline").view = "ui://other.app/x"; }, /one of its own/);
refused((p) => { sf(p, "outline").view = "https://evil.example/x"; }, /one of its own/);
refused((p) => { x(p).permissions.required[0].paths = [".env"]; }, /never \.git/);
refused((p) => { x(p).permissions.required[0].paths = ["../x/**"]; }, /never \.git/);
refused((p) => { x(p).permissions.required[0].paths = [".git/**"]; }, /never \.git/);
refused((p) => { x(p).permissions.required[0].paths = ["/etc/passwd"]; }, /never \.git/);
refused((p) => { x(p).permissions.required.push({ cap: "inference", why: "x" }); }, /isn't a permission/);
refused((p) => { x(p).permissions.required.push({ cap: "terminal", why: "x" }); }, /isn't a permission/);
refused((p) => { x(p).permissions.required[0].why = ""; }, /say why/);
refused((p) => { x(p).documents[0].pattern = "**/*.md"; }, /own file type/);
refused((p) => { x(p).documents[0].pattern = "src/*.ts"; }, /own file type/);
refused((p) => { x(p).documents[0].pattern = "**/*"; }, /own file type/);
refused((p) => { sf(p, "open-outline").opens = "nope"; }, /isn't one of its panel/);
refused((p) => { x(p).surfaces.push({ id: "home", place: "home.section" }); }, /isn't a place apps can use/);
refused((p) => { x(p).surfaces = { panel: [] }; }, /must be a list/);
refused((p) => { sf(p, "new").run = { tool: "agent_only" }; }, /"app" visibility/);
refused((p) => { sf(p, "new").run = { tool: "word_create", prompt: "x" }; }, /one tool or one prompt/);
refused((p) => { sf(p, "new").slash = "/Bad Slash"; }, /slash/);
refused((p) => { sf(p, "outline").when = "eval('x')"; }, /must look like/);
refused((p) => { sf(p, "editor").for = "sheet"; }, /"for" must name/);
refused((p) => { x(p).surfaces.push({ ...sf(p, "outline") }); }, /its own short id/);
refused((p) => { sf(p, "prefs").fields.push({ name: "s", label: "S", type: "html" }); }, /needs a label and a type/);
refused((p) => { x(p).tools.word_create.risk = "low"; }, /risk is/);
const hello = checkManifest(JSON.parse(readFileSync(new URL("./fixtures/hello.plugin.json", import.meta.url), "utf8")));
assert.deepEqual(hello.problems, [], "xo-space's test app and the sample app pass");
const warned = clone();
x(warned).surfaces.push({ id: "rail", place: "rail.entry", title: "Word", icon: "doc" });
x(warned).permissions.optional.push({ cap: "network", why: "x" });
const w = checkManifest(warned);
assert.ok(w.app, "a place XO can't show yet, or the old network permission, is a warning, not a refusal");
assert.equal(w.warnings.length, 2);
console.log("ok manifest: the Word fixture passes; every unsafe or unknown field is refused in plain words");
