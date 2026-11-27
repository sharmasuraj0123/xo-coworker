// @ts-check

import { ApiError } from "../../core/platform/http.js";

/** @import { ScheduleApi } from "../../core/platform/schedule-response-types" */

/** The browser's time zone, which calendar rules run in. */
export const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

/** @typedef {{ api: Pick<ScheduleApi, "scheduleZone" | "setScheduleZone">, zone: () => string, report: (e: unknown) => void }} ZoneDeps */

/** XO Space's default zone kept the browser's; a zone XO refuses isn't sent again. @param {ZoneDeps} deps */
export function keepZone({ api, zone, report }) {
  let saved = "", refused = "", busy = false;
  return async function sync() {
    const tz = zone();
    if (!tz || tz === saved || tz === refused || busy) return;
    busy = true;
    try {
      if ((await api.scheduleZone()).tz !== tz) await api.setScheduleZone(tz);
      saved = tz;
    } catch (error) {
      if (!(error instanceof ApiError)) report(error);
      else if (error.status >= 400 && error.status < 500) refused = tz;
    } finally {
      busy = false;
    }
  };
}
