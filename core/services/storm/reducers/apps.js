// @ts-check

/** @typedef {import("../types").Reducer} Reducer */

/** A field as a plain word, or null: never an object a frame could carry. @param {unknown} v */
const word = (v) => (typeof v === "string" ? v : typeof v === "number" && Number.isFinite(v) ? String(v) : null);

/** @type {Record<string, Reducer>} */
export const apps = {
  // an app was installed, updated or removed: only its id, slug, change, version and project are passed on, nothing is kept
  "apps.changed"(ctx, env, d) {
    ctx.event({ kind: "apps_changed", id: word(d.id), slug: word(d.slug), change: word(d.change), version: word(d.version), project: word(d.project) });
  },
};
