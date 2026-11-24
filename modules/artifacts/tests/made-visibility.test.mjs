import assert from "node:assert/strict";
import { deferred, dom, settle } from "../../../tests/lib/dom.mjs";
import { createScope } from "../../../core/kernel/scope.js";
import { createPlaces } from "../../../core/kernel/places.js";

const { document } = await dom('<div id="home"></div>');
globalThis.localStorage = { getItem: () => null };
const { createRecord } = await import("../../../js/recordview.js");
const project = { id: "demo", name: "Demo", chatId: "chat" };
const world = { state: { projects: [project], threads: [] }, project: () => project, thread: () => null };
const rows = Array.from({ length: 1 }, (_, i) => ({
  id: `image-${i}`, name: `image-${i}.png`, relative_path: `image-${i}.png`, project_id: "demo", updated_at: "2026-11-19T12:00:00Z",
}));
const requests = [];
const pending = deferred();
globalThis.fetch = async (input, { signal } = {}) => {
  const url = new URL(String(input), "https://xo.test/");
  if (url.pathname === "/api/chat/chats") return Response.json({ chats: [] });
  if (url.pathname.endsWith("/made")) return Response.json({ made: rows });
  assert.match(url.pathname, /\/image$/);
  requests.push({ path: url.searchParams.get("relative_path"), signal });
  return pending.promise;
};
const visits = [];
const scope = createScope();
const places = createPlaces();
let rejectArtifacts = true;
places.define({ id: "home.section", kind: "list", scope: "app", description: "Sections displayed on Home.",
  check(entry) { if (rejectArtifacts && entry.id === "hm-made") throw new Error("record slot unavailable"); },
});
const options = { world, go: (view) => visits.push(view), VW: { open() {} }, PROJ: () => project.name,
  schedule() {}, announce() {}, places };
const failedScope = createScope();
assert.throws(() => createRecord({ ...options, scope: failedScope }), /record slot unavailable/);
assert.equal(places.entries("home.section").length, 0, "a failed mount removes the earlier contribution");
assert.equal(failedScope.size, 0, "a failed mount releases its registered effects");
rejectArtifacts = false;
const record = createRecord({ ...options, scope });
assert.equal(places.entries("home.section").length, 2, "the record mounts the Since and Artifacts sections");
const host = document.getElementById("home");
record.homeMade(host);
await settle();
record.homeMade(host);
await settle();
const card = host.querySelector('[data-k="image-0"]');
assert.ok(card, "the record paints the card on the live Home strip");
assert.deepEqual(requests.map((r) => r.path), ["image-0.png"]);
const link = document.createElement("button");
link.setAttribute("data-made-go", "t:made");
document.body.append(link);
link.click();
assert.deepEqual(visits, ["t:made"]);
record.dispose();
assert.equal(places.entries("home.section").length, 0, "disposing the record removes both Home sections");
assert.equal(scope.size, 0);
assert.equal(requests[0].signal.aborted, true);
link.click();
assert.deepEqual(visits, ["t:made"], "disposal removes the delegated document listener");
pending.resolve(new Response(new Blob(["image"])));
await settle();
assert.ok(!card.querySelector("img"), "a late answer leaves the disposed surface alone");
