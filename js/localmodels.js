// Settings > Runtimes: connect an OpenAI-compatible model through XO Space.
// The browser never contacts the model server. Draft keys stay in memory until saved;
// saved keys are represented by api_key_set and never sent back by the backend.
import { api } from "./api.js";
import { esc } from "./world.js";
import { once, busyAttrs, isPending } from "./pending.js";

const KEY = "local-model-connection";
const defaults = { enabled: false, base_url: "http://127.0.0.1:8090/v1", model: "" };
const draftOf = (config) => ({ ...defaults, enabled: !!config?.enabled, base_url: config?.base_url || defaults.base_url, model: config?.model || "", api_key: "", clear_key: false });
const fingerprint = (draft) => JSON.stringify(draft);

export function createLocalModelSettings({ world, announce, draw }) {
  const L = { config: null, draft: null, dirty: false, models: [], error: null, note: "", operation: null, read: 0 };

  function html() {
    const head = `<section class="set-sec" data-key="local-model" aria-labelledby="local-model-h"><h3 id="local-model-h">Local model</h3>` +
      `<p class="set-lead">Connect llama.cpp, Ollama or another OpenAI-compatible server. XO Space sends messages to it from this machine.</p>`;
    if (!L.draft) return head + (L.error ? `<p class="set-err" role="alert">${esc(L.error)}</p><div class="set-fa"><button type="button" class="btn" data-local-retry>Try again</button></div>` : `<p class="set-note"><i class="spin" aria-hidden="true"></i> Reading the connection.</p>`) + `</section>`;
    const d = L.draft, busy = busyAttrs(KEY), readonly = isPending(KEY) ? ' aria-disabled="true"' : "";
    const modelOptions = L.models.map((m) => `<option value="${esc(typeof m === "string" ? m : m.id)}">${esc(typeof m === "string" ? m : m.name || m.label || m.id)}</option>`).join("");
    const health = L.config?.health;
    const status = L.config?.enabled ? (health?.usable ? "Saved connection: connected." : health?.why_not || "Saved. Test the connection to check the model server.") : "Disabled. Enable it to make the local runtime available.";
    return head + `<form class="set-form local-model-form" data-local-form autocomplete="off">` +
      `<label class="rt-check"><input type="checkbox" name="enabled" data-local-field="enabled"${d.enabled ? " checked" : ""}${readonly}><span>Enable local model</span></label>` +
      `<label class="field"><span>API base URL</span><input type="url" name="base_url" data-local-field="base_url" value="${esc(d.base_url)}" placeholder="http://127.0.0.1:8090/v1" required spellcheck="false" autocapitalize="off" maxlength="2048"><small class="cp-note">Include /v1. The address is relative to the machine running XO Space.</small></label>` +
      `<label class="field"><span>Model ID</span><input name="model" data-local-field="model" list="local-model-options" value="${esc(d.model)}" placeholder="Test the connection to discover models" spellcheck="false" autocapitalize="off" maxlength="256"><small class="cp-note">Use the exact model ID advertised by your server.</small></label>` +
      `<datalist id="local-model-options">${modelOptions}</datalist>` +
      `<label class="field"><span>API key <em>optional</em></span><input type="password" name="api_key" data-local-field="api_key" value="${esc(d.api_key)}" autocomplete="new-password" spellcheck="false" placeholder="${L.config?.api_key_set ? "Saved key is kept when this is blank" : "Usually blank for a local server"}"></label>` +
      (L.config?.api_key_set ? `<label class="rt-check"><input type="checkbox" name="clear_key" data-local-field="clear_key"${d.clear_key ? " checked" : ""}${readonly}><span>Remove saved API key</span></label>` : "") +
      `<p class="set-note">${esc(status)} Once enabled, choose Local model in a conversation's model picker or set it as the usual runtime below.</p>` +
      (L.error ? `<p class="set-err" role="alert">${esc(L.error)}</p>` : "") +
      (L.note || L.dirty ? `<p class="set-note" role="status">${esc(L.note || "Unsaved changes.")}</p>` : "") +
      `<div class="set-fa"><button type="button" class="btn" data-local-test${busy}>${L.operation === "test" ? "Testing connection…" : "Test connection"}</button><button type="submit" class="btn btn-pri" data-local-save${busy}>${L.operation === "save" ? "Saving…" : "Save connection"}</button></div></form></section>`;
  }

  async function load() {
    const read = ++L.read;
    L.error = null;
    draw();
    try {
      const config = await api.localModel();
      if (read !== L.read) return;
      L.config = config;
      L.models = config.models || [];
      // Opening Settings again preserves an unsaved draft, including after a refused save.
      if (!L.draft || !L.dirty) L.draft = draftOf(config);
    } catch (err) {
      if (read !== L.read) return;
      L.error = err.status === 404 ? "This XO Space backend does not support local models yet. Update XO Space, then try again." : err.message;
    } finally {
      if (read === L.read) draw();
    }
  }

  function payload(draft) {
    return { enabled: draft.enabled, base_url: draft.base_url.trim(), model: draft.model.trim(),
      ...(draft.clear_key ? { api_key: "" } : draft.api_key ? { api_key: draft.api_key } : {}) };
  }

  async function run(operation) {
    if (!L.draft || isPending(KEY)) return;
    const form = document.querySelector("[data-local-form]");
    if (form && !form.reportValidity()) return;
    const draft = { ...L.draft }, sent = fingerprint(draft), body = payload(draft);
    if (operation === "save" && body.enabled && !body.model) {
      L.error = "Enter a model ID, or test the connection to discover one."; L.note = ""; draw(); return;
    }
    L.error = null; L.note = ""; L.operation = operation;
    const task = once(KEY, async () => {
      try {
        const result = operation === "test" ? await api.testLocalModel(body) : await api.setLocalModel(body);
        L.models = result.models || L.models;
        if (operation === "test") {
          if (fingerprint(L.draft) !== sent) return;
          const models = L.models.map((m) => typeof m === "string" ? m : m.id);
          if (!L.draft.model && models.length) { L.draft.model = result.model || models[0]; L.dirty = true; }
          if (result.health?.usable === false || result.ok === false) throw new Error(result.health?.why_not || result.message || "The model server could not be reached.");
          L.note = `Connection works.${models.length ? ` Found ${models.length} model${models.length === 1 ? "" : "s"}.` : ""} Save the connection to use it.`;
          announce(L.note);
        } else {
          L.config = result;
          if (fingerprint(L.draft) === sent) { L.draft = draftOf(result); L.dirty = false; L.note = "Connection saved."; }
          else L.note = "Connection saved. Your latest edits are unsaved.";
          await Promise.allSettled([world.act.loadRuntimes?.(), world.act.loadPolicies?.()]);
          announce(L.note);
        }
      } catch (err) { L.error = err.message; }
      finally { L.operation = null; }
    });
    draw();
    await task;
    draw();
  }

  const root = document.querySelector("#settings");
  root.addEventListener("input", (event) => {
    const field = event.target.dataset?.localField;
    if (!field || !L.draft) return;
    L.draft[field] = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    L.dirty = true; L.note = ""; L.error = null;
    draw();
  });
  root.addEventListener("click", (event) => {
    if (event.target.closest?.("[data-local-retry]")) load();
    if (event.target.closest?.("[data-local-test]")) run("test");
    if (isPending(KEY) && event.target.matches?.('[data-local-field="enabled"], [data-local-field="clear_key"]')) event.preventDefault();
  });
  root.addEventListener("submit", (event) => {
    if (!event.target.matches?.("[data-local-form]")) return;
    event.preventDefault(); run("save");
  });
  return { html, open: load };
}
