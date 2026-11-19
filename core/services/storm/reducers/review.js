// @ts-check

/** @typedef {import("../types").Reducer} Reducer */

/** @type {Reducer} */
const closed = (ctx, env, d) => { ctx.state.review.delete(d.id); ctx.soon(); };

/** @type {Record<string, Reducer>} */
export const review = {
  "review.opened"(ctx, env, d) {
    ctx.state.review.set(d.id, { ...d, state: "open", seq: env.seq ?? null });
    ctx.soon();
  },
  "review.decided": closed,
  "review.withdrawn": closed,
  "review.expired": closed,
  "review.parked"(ctx, env, d) {
    const it = ctx.state.review.get(d.id);
    if (it) { ctx.state.review.set(d.id, { ...it, parked: true, expires_at: d.expires_at || it.expires_at }); ctx.soon(); }
  },
  "review.annotated"(ctx, env, d) {
    const it = ctx.state.review.get(d.id);
    if (it) { ctx.state.review.set(d.id, { ...it, annotations: [...(it.annotations || []), d] }); ctx.soon(); }
  },
};
