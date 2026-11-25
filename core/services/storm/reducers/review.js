// @ts-check

/** @typedef {import("../types").Reducer} Reducer */

/** @type {Reducer} */
const closed = (ctx, env, d) => { ctx.state.review.delete(d.id); ctx.soon(); };

/** @type {Reducer} */
const gone = (ctx, env, d, tid, type) => {
  ctx.state.gone.set(d.id, { state: type === "review.withdrawn" ? "withdrawn" : "expired", reason: d.reason || null, why: d.why || "", at: Date.now() });
  if (ctx.state.gone.size > 200) {
    const oldest = ctx.state.gone.keys().next();
    if (!oldest.done) ctx.state.gone.delete(oldest.value);
  }
  closed(ctx, env, d, tid, type);
};

/** @type {Record<string, Reducer>} */
export const review = {
  "review.opened"(ctx, env, d) {
    if (typeof d.id !== "string") return;
    ctx.state.review.set(d.id, { ...d, id: d.id, state: "open", seq: env.seq });
    ctx.soon();
  },
  "review.decided": closed,
  "review.withdrawn": gone,
  "review.expired": gone,
  "review.parked"(ctx, env, d) {
    const it = ctx.state.review.get(d.id);
    if (it) { ctx.state.review.set(d.id, { ...it, parked: true, expires_at: d.expires_at || it.expires_at }); ctx.soon(); }
  },
  "review.annotated"(ctx, env, d) {
    const it = ctx.state.review.get(d.id);
    if (it && typeof d.by === "string" && typeof d.note === "string") {
      const annotation = { ...d, by: d.by, note: d.note };
      ctx.state.review.set(d.id, { ...it, annotations: [...(it.annotations || []), annotation] });
      ctx.soon();
    }
  },
};
