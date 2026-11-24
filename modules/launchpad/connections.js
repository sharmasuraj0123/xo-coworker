// @ts-check
import { createScope } from "../../core/kernel/scope.js";
import { cancelLatest, latest } from "../../core/platform/latest.js";
import { reportFailure } from "../../core/services/notices/failures.js";
import { AFTER, NEEDS_YOU } from "./words.js";

const DEVICE_POLL_MS = 2500;

/** @import { LaunchpadRecords } from "./lifetime-types.d.ts" */

/** @typedef {Pick<LaunchpadRecords, "api" | "windowScope" | "proj" | "land" | "announce" | "changed" | "tell">} ConnectionRecords */

/** @param {ConnectionRecords & {preflight(p: string): void}} records */
export function installConnections({ api, windowScope, proj, land, announce, changed, tell, preflight }) {
  /** @param {string} p */
  async function github(p) {
    const mount = windowScope(), s = proj(p), gh = s.check?.github;
    if (!mount || mount.signal.aborted || !gh) return;
    s.device?.dispose();
    const flow = createScope();
    const dispose = mount.effect(() => () => { flow.dispose(); s.device = null; });
    /** @type {NonNullable<typeof s.device>} */
    const device = s.device = { code: "", url: "", copiedUntil: 0, dispose };
    const { signal } = flow;
    /** @param {string} message */
    const connected = (message) => {
      dispose(); s.pre = 0; land(AFTER + ', [data-lp="retry"]');
      if (NEEDS_YOU.has(s.run?.error?.code || "")) s.run = null;
      announce(message); changed(); preflight(p);
    };
    /** @param {unknown} error */
    const failed = (error) => {
      dispose(); land('[data-lp="reconnect"]');
      tell(`GitHub didn't connect: ${error instanceof Error ? error.message : String(error)}`, null, "err"); changed();
    };
    land('[data-lp="code-copy"], [data-lp="device-cancel"]');
    changed();
    try {
      const d = await api.githubStart(gh.connected && gh.source === "connections", signal);
      if (signal.aborted) return;
      if (d.connected) {
        connected(`GitHub is connected${d.username ? ` as ${d.username}` : ""}${d.imported ? ", from this machine's gh login" : ""}.`);
        return;
      }
      const { id, code, url, until } = d;
      if (!id || !code || !url) throw new Error("Space didn't return a device code");
      Object.assign(device, { id, code, url });
      changed();
      function schedulePoll() {
        if (until && Date.now() >= until) {
          dispose(); land('[data-lp="reconnect"]'); tell("GitHub's code ran out. Reconnect again.", null, "err"); changed();
        } else flow.timeout(poll, DEVICE_POLL_MS);
      }
      async function poll() {
        try {
          const r = await api.githubPoll(id, signal);
          if (signal.aborted) return;
          if (r?.failed) throw new Error(r.failed);
          if (r?.done) connected("GitHub is connected.");
          else schedulePoll();
        } catch (error) { if (!signal.aborted) failed(error); }
      }
      schedulePoll();
    } catch (error) { if (!signal.aborted) failed(error); }
  }

  /** @param {string} p */
  async function startPick(p) {
    const s = proj(p), mount = windowScope();
    if (!mount || mount.signal.aborted) return;
    /** @type {NonNullable<typeof s.picking>} */
    const picking = s.picking = { apps: null };
    land('[data-lp="pick-cancel"]');
    changed();
    try {
      await latest(s, async (signal) => {
        try {
          const apps = await api.apps(p, signal);
          if (signal.aborted) return;
          picking.apps = apps;
        } catch (error) {
          if (signal.aborted) return;
          s.picking = null; land('[data-lp="pick"]');
          tell(`Couldn't read your Launchpad apps: ${error instanceof Error ? error.message : String(error)}`, null, "err");
        }
        changed();
      }, { signal: mount.signal });
    } catch (error) { if (!(error instanceof Error && error.name === "AbortError")) reportFailure(error); }
  }

  /** @param {string} p */
  function cancelPick(p) {
    const s = proj(p);
    cancelLatest(s); s.picking = null; land('[data-lp="pick"]'); changed();
  }

  /** @param {string} p */
  function cancelDevice(p) {
    const { device } = proj(p);
    if (device?.id) void api.githubCancel(device.id);
    device?.dispose(); land('[data-lp="reconnect"], [data-lp="deploy"]'); changed();
  }

  return { github, startPick, cancelPick, cancelDevice };
}
