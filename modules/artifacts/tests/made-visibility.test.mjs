import assert from "node:assert/strict";
import { deferred, dom, settle } from "../../../tests/lib/dom.mjs";
import { createScope } from "../../../core/kernel/scope.js";

const { document } = await dom('<div id="tab"></div>');
const observers = [];
globalThis.IntersectionObserver = class {
  nodes = new Set();
  constructor(callback) { this.callback = callback; observers.push(this); }
  observe(node) { this.nodes.add(node); }
  unobserve(node) { this.nodes.delete(node); }
  disconnect() { this.nodes.clear(); }
};
globalThis.localStorage = { getItem: () => null };
const { createRecord } = await import("../../../js/recordview.js");
const project = { id: "demo", name: "Demo", chatId: "chat" };
const world = { state: { projects: [project], threads: [] }, project: () => project, thread: () => null };
const rows = Array.from({ length: 50 }, (_, i) => ({
  id: `image-${i}`, name: `image-${i}.png`, relative_path: `image-${i}.png`, project_id: "demo", updated_at: "2026-11-19T12:00:00Z",
}));
const requests = [];
const pending = deferred();
globalThis.fetch = async (input, { signal } = {}) => {
  const url = new URL(String(input), "https://xo.test/");
  if (url.pathname.endsWith("/made")) return Response.json({ made: rows });
  assert.match(url.pathname, /\/image$/);
  requests.push({ path: url.searchParams.get("relative_path"), signal });
  return pending.promise;
};
const visits = [];
const scope = createScope();
const record = createRecord({ scope, world, go: (view) => visits.push(view), VW: { open() {} }, PROJ: () => project.name,
  schedule() {}, announce() {}, places: { contribute() {} } });
const host = document.getElementById("tab");
record.panel = { isOpen: true };
record.made.mount(host);
record.made.show("p:demo");
await settle();
const [observer] = observers;
assert.equal(observer.nodes.size, rows.length);
assert.equal(requests.length, 0, "offscreen cards make no thumbnail requests");
const card = host.querySelector('[data-k="image-49"]');
observer.callback([{ target: card, isIntersecting: true }]);
await settle();
assert.deepEqual(requests.map((r) => r.path), ["image-49.png"]);
const link = document.createElement("button");
link.setAttribute("data-made-go", "t:made");
document.body.append(link);
link.click();
assert.deepEqual(visits, ["t:made"]);
record.dispose();
assert.equal(scope.size, 0);
assert.equal(observer.nodes.size, 0);
assert.equal(requests[0].signal.aborted, true);
link.click();
assert.deepEqual(visits, ["t:made"], "disposal removes the delegated document listener");
pending.resolve(new Response(new Blob(["image"])));
await settle();
assert.equal(card.querySelector("img"), null, "a late answer leaves the disposed surface alone");
