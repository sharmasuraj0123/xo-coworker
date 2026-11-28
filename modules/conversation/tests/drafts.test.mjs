import assert from "node:assert/strict";
import { createDrafts } from "../drafts.js";

const key = "cv-drafts:live";
const values = new Map([[key, JSON.stringify({ "p:demo": "Existing draft", "t:review": "In the panel", junk: 12 })]]);
globalThis.localStorage = { getItem: (name) => values.get(name), setItem: (name, value) => values.set(name, value) };
const main = { view: "p:demo", say: { value: "" } };
const panel = { view: "t:review", say: { value: "" } };
const restored = [];
const { saveDraft, loadDraft } = createDrafts(main, (composer) => restored.push(composer.say.value));
loadDraft();
loadDraft(panel);
assert.deepEqual(restored, ["Existing draft", "In the panel"], "Older drafts restore for each composer");

main.say.value = "";
panel.say.value = "Updated in the panel";
saveDraft();
saveDraft(panel);
assert.deepEqual(JSON.parse(values.get(key)), { "t:review": "Updated in the panel" });
const reopened = createDrafts(main, () => {});
panel.say.value = "";
reopened.loadDraft(panel);
assert.equal(panel.say.value, "Updated in the panel");

globalThis.localStorage.setItem = () => { throw new DOMException("QuotaExceededError"); };
panel.say.value = "Still in this session";
reopened.saveDraft(panel);
panel.say.value = "";
reopened.loadDraft(panel);
assert.equal(panel.say.value, "Still in this session");
