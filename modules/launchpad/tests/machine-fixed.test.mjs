import assert from "node:assert/strict";
import test from "node:test";
import { installViews } from "../views.js";

const app = { id: "a1", name: "demo", host: "demo.example", url: "https://demo.example", status: "running", size: "xo.medium", sizeLabel: "Medium", storage: null };
function view(sc, extra = {}) {
  const check = { state: "linked", name: "demo", repo: { branch: "main", full: "me/demo", admin: true }, github: { connected: true, workflow: true }, blockers: [], warnings: [], env: [], app, sizes: { def: "xo.medium", tiers: [{ name: "xo.medium", label: "Medium", cpu: 1, memory_gb: 4 }] } };
  const rec = { check, run: null, err: null, asked: null, asking: false, copied: 0, menu: false, warn: null, form: { name: "demo", port: "8080", env: {}, errs: {}, size: "", disk: false, diskPath: "", diskGb: "2" }, ...extra };
  const L = { S: {}, proj: () => rec, nameOf: () => "demo", findThread: () => null, screen: () => sc, summary: () => ({ tone: "go", words: "Live" }) };
  installViews(L);
  return L.bodyHtml("demo").html;
}

test("a live app's machine is fixed on Launchpad, so nothing offers to change it", () => {
  const live = view("live");
  assert.match(live, /Medium/, "the machine is still shown");
  assert.doesNotMatch(live, /the machine/, "no Change beside it");
  const settings = view("setup", { editing: true });
  assert.doesNotMatch(settings, /data-lp-f="size"|>Size</, "its settings offer no size");
  assert.doesNotMatch(settings, /Can't be added after creation/, "nor a disk it can't have");
  assert.match(settings, /data-lp-f="port"/, "the port stays changeable");
});
