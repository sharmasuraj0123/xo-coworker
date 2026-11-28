// @ts-check

// What the screens read that XO Space doesn't send yet; connecting each changes only this file.

/** @import { ScheduledJob } from "../../core/platform/schedule-response-types" */

const ICONS = new Set(["automation", "nightly", "sunrise", "backup-check", "pulse", "package-up"]);

/** Whether a run found something; null when the run doesn't say. @param {{ found?: boolean | null }} result */
export const foundOf = (result) => typeof result.found === "boolean" ? result.found : null;

/** @param {ScheduledJob} job */
export const iconOf = (job) => typeof job.icon === "string" && ICONS.has(job.icon) ? job.icon : "automation";

/** How often lists refresh while open, until XO Space sends a change event for jobs. */
export const REFRESH_MS = 60_000;
