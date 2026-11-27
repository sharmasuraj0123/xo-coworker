// @ts-check

/** @import { ScheduleApi } from "../../core/platform/schedule-response-types" */

/** The browser's time zone, which calendar rules run in. */
export const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

/** @typedef {{ api: Pick<ScheduleApi, "scheduleZone" | "setScheduleZone">, zone: () => string, report: (e: unknown) => void }} ZoneDeps */

/** XO Space's default zone kept the browser's, so a rule naming none runs in local time. @param {ZoneDeps} deps */
export function keepZone({ api, zone, report }) {
  let saved = "", busy = false;
  return async function sync() {
    const tz = zone();
    if (!tz || tz === saved || busy) return;
    busy = true;
    try {
      if ((await api.scheduleZone()).tz !== tz) await api.setScheduleZone(tz);
      saved = tz;
    } catch (error) {
      report(error);
    } finally {
      busy = false;
    }
  };
}
