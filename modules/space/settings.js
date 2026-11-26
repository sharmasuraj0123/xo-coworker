// @ts-check
import { createScope } from "../../core/kernel/scope.js";
import { requireHtml } from "../../core/platform/dom.js";
import { esc } from "../../core/platform/util.js";
import { changeSecret, readDoctor, readSecretKeys } from "../../core/platform/space-settings-response.js";
import { requestFailureMessage } from "../../core/services/notices/failures.js";
import { redraw } from "../../core/ui/redraw.js";

/** @param {HTMLElement} host */
export function diagnostics(host) {
  const scope = createScope();
  redraw(host, '<button type="button" class="btn" data-check>Run checks</button><div aria-live="polite"></div>');
  const button = requireHtml("button", "button", host), result = requireHtml("div", "div", host);
  scope.listen(button, "click", async () => {
    button.disabled = true;
    result.textContent = "Checking…";
    try {
      const { checks } = await readDoctor(scope.signal);
      redraw(result, checks.map(c => `<section><h3>${esc(c.id)}</h3>`
        + (c.error ? `<p>${esc(c.error)}</p>` : (c.findings ?? []).map(f => `<p>${esc(f.level)} · ${esc(f.observed)}</p>`).join(""))
        + "</section>").join("") || "<p>No checks returned.</p>");
    } catch (error) {
      if (!scope.signal.aborted) result.textContent = requestFailureMessage(error, "Diagnostics unavailable");
    } finally { button.disabled = false; }
  });
  return scope.dispose;
}

/** @param {HTMLElement} host */
export function secrets(host) {
  const scope = createScope();
  redraw(host, '<form><label>Key<input name="key" required pattern="[A-Z_][A-Z0-9_]*" autocomplete="off"></label>'
    + '<label>Value<input name="value" type="password" autocomplete="new-password" required></label>'
    + '<button class="btn" type="submit">Save secret</button></form><p role="status"></p><ul></ul>');
  const form = requireHtml("form", "form", host), status = requireHtml("p", "p", host), list = requireHtml("ul", "ul", host);
  const key = requireHtml("[name=key]", "input", form), value = requireHtml("[name=value]", "input", form);
  let pending = false;
  async function refresh() {
    try {
      const keys = await readSecretKeys(scope.signal);
      redraw(list, keys.map(id => `<li><b>${esc(id)}</b> <details><summary>Remove…</summary>`
        + `<button class="btn" type="button" data-remove-secret="${esc(id)}">Confirm removal</button></details></li>`).join(""));
    } catch (error) {
      if (!scope.signal.aborted) status.textContent = requestFailureMessage(error, "Could not list secret keys");
    }
  }
  /** @param {string} id @param {string|null} next */
  async function save(id, next) {
    if (pending) return;
    pending = true;
    try {
      await changeSecret(id, next, scope.signal);
      status.textContent = next === null ? "Secret removed." : "Secret saved.";
      await refresh();
    } catch (error) {
      if (!scope.signal.aborted) status.textContent = requestFailureMessage(error, "Could not update this secret");
    } finally { pending = false; }
  }
  scope.listen(form, "submit", event => {
    event.preventDefault();
    if (pending || !key.value.match(/^[A-Z_][A-Z0-9_]*$/) || !value.value) return;
    void save(key.value, value.value);
    value.value = "";
  });
  scope.listen(list, "click", ({ target }) => {
    const id = target instanceof Element && target.closest("[data-remove-secret]")?.getAttribute("data-remove-secret");
    if (id) void save(id, null);
  });
  void refresh();
  return () => { scope.dispose(); value.value = ""; host.replaceChildren(); };
}
