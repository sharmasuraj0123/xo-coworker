import assert from "node:assert/strict";
import { deferred, dom, settle } from "../../../tests/lib/dom.mjs";
import { createKernel } from "../../../core/kernel/index.js";
import { createAppServices } from "../../../shell/app-services.js";

const { document } = await dom('<div id="home"></div>');
globalThis.localStorage = { getItem: () => null };
const { createArtifactsModule } = await import("../module.js");
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
const warnings = [];
const kernel = createKernel({ warn: (...args) => warnings.push(args) });
const { places } = kernel;
let rejectArtifacts = true;
places.define({ id: "home.section", kind: "list", scope: "app", description: "Sections displayed on Home.",
  check(entry) { if (rejectArtifacts && entry.id === "hm-made") throw new Error("record slot unavailable"); },
});
places.define({ id: "page", kind: "keyed", scope: "app", description: "Main pages" });
places.define({ id: "search.provider", kind: "list", scope: "app", description: "Jump results" });
const artifacts = createArtifactsModule({
  go: (view) => visits.push(view), VW: { open() {} }, skTile: () => "", skBar: () => "", rememberedMade: () => null,
});
kernel.register(createAppServices({ world, announce() {}, projectName: () => project.name, currentView: () => "home" }, () => {}));
kernel.register(artifacts.module);
const failed = await kernel.start();
assert.match(failed.failed[0]?.error, /record slot unavailable/);
assert.equal(places.entries("home.section").length, 0, "a failed mount leaves no contribution");
assert.equal(kernel.live("xo.artifacts"), 0, "a failed mount releases its registered effects");
assert.equal(warnings.length, 1);
rejectArtifacts = false;
await kernel.enable("xo.artifacts");
assert.deepEqual(places.entries("home.section").map(({ id }) => id), ["hm-made"], "the record mounts the Artifacts section");
const section = places.get("home.section", "hm-made");
const host = document.getElementById("home");
section.render(host);
await settle();
section.render(host);
await settle();
const card = host.querySelector('[data-k="image-0"]');
assert.ok(card, "the record paints the card on the live Home strip");
assert.deepEqual(requests.map((r) => r.path), ["image-0.png"]);
const link = document.createElement("button");
link.setAttribute("data-made-go", "t:made");
document.body.append(link);
link.click();
assert.deepEqual(visits, ["t:made"]);
await kernel.disable("xo.artifacts");
assert.equal(places.entries("home.section").length, 0, "disposing the record removes the Artifacts section");
assert.equal(kernel.live("xo.artifacts"), 0);
assert.equal(places.get("page", "artifacts"), undefined);
assert.deepEqual(places.entries("search.provider"), []);
assert.equal(requests[0].signal.aborted, true);
link.click();
assert.deepEqual(visits, ["t:made"], "disposal removes the delegated document listener");
pending.resolve(new Response(new Blob(["image"])));
await settle();
assert.ok(!card.querySelector("img"), "a late answer leaves the disposed surface alone");
