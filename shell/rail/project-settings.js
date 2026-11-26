// @ts-check
import { requireHtml } from "../../core/platform/dom.js";
import { latest, cancelLatest } from "../../core/platform/latest.js";
import { projectAccess, projectSync, applySharedCommits, removeProject } from "../../core/platform/project-access-response.js";
import { shareProject } from "../../core/platform/project-access-response.js";
import { esc } from "../../core/platform/util.js";
import { requestFailureMessage } from "../../core/services/notices/failures.js";
import { redraw } from "../../core/ui/redraw.js";

/** @typedef {import("../../core/kernel/types").ModuleContext} Context */

/** @param {Context} ctx @param {ReturnType<typeof import("./projects.js").projectPicker>} pins */
export function projectSettings(ctx, pins) {
  const panel = requireHtml("#rail-project-settings"), key = Symbol("project settings");
  const name = ctx.use("placeContext").PROJ, navigate = ctx.use("navigation"), view = ctx.use("currentView");
  let selected = "", busy = false, allowed = false;
  const syncKey = Symbol("project sync");
  const close = () => { cancelLatest(key); cancelLatest(syncKey); selected = ""; allowed = false; };
  ctx.listen(panel, "beforetoggle", (event) => { if ("newState" in event && event.newState === "closed") close(); });
  ctx.on("app:render", () => { if (selected && view() !== "p:" + selected) panel.hidePopover(); });
  ctx.effect(() => () => { if (selected) panel.hidePopover(); close(); });
  /** @param {string} id */
  async function open(id) {
    if (busy) return;
    selected = id;
    allowed = false;
    redraw(panel, `<section><h2>${esc(name(id))}</h2><button type="button" data-project-icon>Change icon</button>`
      + `<button type="button" data-pin aria-pressed="${pins.pinned(id)}">Pin to sidebar</button></section>`
      + '<section data-sync aria-live="polite"></section><section data-access aria-live="polite">Reading project access…</section>'
      + '<section><h2>Tools for this project</h2><button type="button" data-launch>Launchpad</button>'
      + '<button type="button" data-set-open="worktrees">Worktrees</button>'
      + '<button type="button" data-set-open="rules">Rules</button></section>');
    panel.showPopover();
    void sync(id);
    const access = requireHtml("[data-access]", "section", panel);
    try {
      await latest(key, signal => projectAccess(id, signal), { signal: ctx.signal, commit(data) {
        if (data.project_id !== selected) throw new Error("Project access did not match the selected project.");
        const repo = data.repo && /^[\w.-]+\/[\w.-]+$/.test(data.repo) ? data.repo : "";
        allowed = data.can_remove && !data.blockers.length && !data.peers.length && !data.members.some(m => m.can_revoke);
        redraw(access, (repo ? `<a href="https://github.com/${esc(repo)}" target="_blank" rel="noopener noreferrer">${esc(repo)}</a>` : "")
          + `<p>Sharing · ${data.peers.length} peers</p>`
          + (repo ? '<details><summary>Share project</summary><form data-share><label>Recipient workspace ID'
            + '<input name="workspace" required autocomplete="off"></label><button type="submit">Share</button></form></details>' : "")
          + data.blockers.map(b => `<p>${esc(b.message)}</p>`).join("")
          + (allowed ? `<details><summary>Remove local project…</summary><label>Type ${esc(id)} to confirm<input data-confirm></label>`
            + '<button type="button" data-remove disabled>Remove local project</button></details>' : ""));
      } });
    } catch (error) {
      if (ctx.signal.aborted || selected !== id || (error instanceof Error && error.name === "AbortError")) return;
      access.textContent = requestFailureMessage(error, "Project access unavailable");
    }
  }
  /** @param {string} id */
  async function sync(id) {
    const host = requireHtml("[data-sync]", "section", panel);
    try {
      await latest(syncKey, signal => projectSync(id, signal), { signal: ctx.signal, commit(data) {
        const status = data.behind === null ? "Sync status unavailable" : data.behind === 0 ? "In sync" : `${data.behind} commits to apply`;
        redraw(host, `<p>${esc(data.path)} · ${esc(data.branch)}</p><p>${esc(status)}</p>`
          + (data.behind && data.behind > 0 ? '<button type="button" data-apply>Apply commits</button>' : ""));
      } });
    } catch (error) {
      if (!ctx.signal.aborted && selected === id && !(error instanceof Error && error.name === "AbortError")) {
        host.textContent = requestFailureMessage(error, "Project sync unavailable");
      }
    }
  }
  ctx.listen(panel, "submit", async event => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !form.matches("[data-share]")) return;
    event.preventDefault();
    const id = selected, recipient = requireHtml("input", "input", form).value.trim();
    if (!recipient || !id || busy) return;
    busy = true;
    const submit = requireHtml("button", "button", form);
    submit.disabled = true;
    try {
      await shareProject(id, recipient, ctx.signal);
    } catch (error) {
      if (!ctx.signal.aborted && selected === id) {
        let message = form.querySelector("[role=status]");
        if (!message) { message = document.createElement("p"); message.setAttribute("role", "status"); form.append(message); }
        message.textContent = requestFailureMessage(error, "Could not share project");
      }
      return;
    } finally { busy = false; submit.disabled = false; }
    if (!ctx.signal.aborted && selected === id) await open(id);
  });
  ctx.listen(panel, "input", ({target}) => {
    if (!(target instanceof Element) || !target.matches("[data-confirm]")) return;
    requireHtml("[data-remove]", "button", panel).disabled = busy || requireHtml("[data-confirm]", "input", panel).value !== selected;
  });
  ctx.listen(panel, "click", async ({ target }) => {
    if (!(target instanceof Element) || !selected) return;
    if (target.closest("[data-apply]") && !busy) {
      const id = selected;
      busy = true;
      requireHtml("[data-apply]", "button", panel).disabled = true;
      try {
        await applySharedCommits(id, ctx.signal);
        if (selected === id) await sync(id);
      } catch (error) {
        if (!ctx.signal.aborted && selected === id) requireHtml("[data-sync]", "section", panel).textContent =
          requestFailureMessage(error, "Could not apply shared commits");
      } finally { busy = false; }
    } else if (target.closest("[data-pin]")) {
      pins.toggle(selected);
      requireHtml("[data-pin]", "button", panel).setAttribute("aria-pressed", String(pins.pinned(selected)));
    } else if (target.closest("[data-launch],[data-project-icon],[data-set-open]")) {
      panel.hidePopover();
      if (target.closest("[data-launch]")) requireHtml("#top-end [data-lp-open]", "button").click();
      if (target.closest("[data-project-icon]")) requireHtml("#top-who [data-pj-icon]", "button").click();
    } else if (target.closest("[data-remove]") && allowed && !busy && requireHtml("[data-confirm]", "input", panel).value === selected) {
      const id = selected;
      busy = true;
      requireHtml("[data-remove]", "button", panel).disabled = true;
      try {
        await removeProject(id, ctx.signal);
        if (selected === id) { panel.hidePopover(); navigate.go("home"); }
      } catch (error) {
        if (!ctx.signal.aborted && selected === id) requireHtml("[data-access]", "section", panel).textContent =
          requestFailureMessage(error, "Project removal failed");
      } finally { busy = false; }
    }
  });
  ctx.contribute("header.action", { id: "project-settings", label: "Project settings", icon: "gear",
    when: at => at.view?.startsWith("p:") === true, onPress: at => { if (at.project) void open(at.project); } });
}
