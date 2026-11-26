// @ts-check
import { esc } from "../../core/platform/util.js";
import { saveAgentSchedule } from "../../core/platform/schedule-response.js";
import { requestFailureMessage } from "../../core/services/notices/failures.js";

/** @typedef {Extract<import("../../core/platform/schedule-response-types").ScheduledJob,{kind:"agent"}>} Job */

/** @param {Job | undefined} job */
function firstRun(job) {
  if (!job?.first_run_at) return "";
  const offset = /^([+-])(\d\d):(\d\d)$/.exec(job.utc_offset);
  const utc = Date.parse(job.first_run_at);
  if (!offset || !Number.isFinite(utc)) return job.first_run_at;
  const minutes = (Number(offset[2]) * 60 + Number(offset[3])) * (offset[1] === "-" ? -1 : 1);
  return new Date(utc + minutes * 60000).toISOString().replace("Z", job.utc_offset);
}

/** @param {Job} [job] */
export function scheduleEditor(job) {
  /** @param {string} label @param {string} key @param {string} value @param {string} [options] */
  const field = (label, key, value, options = "") =>
    `<label>${label}<input name="${key}" value="${esc(value)}" ${options}></label>`;
  return `<details><summary>${job ? "Edit schedule" : "New agent schedule"}</summary><form data-schedule="${esc(job?.id || "")}">`
    + field("Name", "name", job?.name || "", "required maxlength=64") + field("Project chat ID", "chat", job?.chat || "", "required")
    + `<label>Prompt<textarea name="prompt" required>${esc(job?.prompt || "")}</textarea></label>`
    + field("Description", "description", job?.description || "")
    + field("First run (ISO date and UTC offset)", "first_run_at", firstRun(job))
    + field("Repeat every (seconds)", "every_seconds", String(job?.every_seconds ?? ""), "type=number min=1")
    + field("Agent", "agent", job?.agent || "") + field("Model", "model", job?.model || "") + field("Effort", "effort", job?.effort || "")
    + `<label><input name="enabled" type="checkbox"${job?.enabled === false ? "" : " checked"}>Enabled</label>`
    + '<button type="submit" class="btn">Save schedule</button><p role="status"></p></form></details>';
}

/** @param {import("../../core/kernel/types").ModuleContext} ctx @param {HTMLElement} host @param {() => Promise<void>} refresh */
export function bindSchedules(ctx, host, refresh) {
  ctx.listen(host, "submit", async event => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !form.hasAttribute("data-schedule")) return;
    event.preventDefault();
    const button = form.querySelector("button"), status = form.querySelector("[role=status]");
    if (!button || !status || button.disabled) return;
    const data = new FormData(form);
    const definition = Object.fromEntries([...data].map(([key, value]) => [key, String(value).trim() || null]));
    button.disabled = true;
    try {
      await saveAgentSchedule(form.dataset.schedule || "", { ...definition,
        enabled: data.has("enabled"), every_seconds: definition.every_seconds ? Number(definition.every_seconds) : null }, ctx.signal);
      if (ctx.signal.aborted) return;
      form.closest("details")?.removeAttribute("open");
      await refresh();
    } catch (error) {
      if (!ctx.signal.aborted) status.textContent = requestFailureMessage(error, "Could not save schedule");
    } finally { button.disabled = false; }
  });
}
