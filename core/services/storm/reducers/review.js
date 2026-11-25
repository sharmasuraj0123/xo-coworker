// @ts-check
import { invalidField, rejectFrame } from "../frame-failures.js";
import { isReview } from "../../../platform/review-responses.js";
import { text } from "../../world/frame-values.js";

/** @typedef {import("../types").Reducer} Reducer */

/** @type {Reducer} */
const closed = (ctx, env, d, tid, type) => {
  if (typeof d.id !== "string") return rejectFrame(ctx, type, "id");
  ctx.state.review.delete(d.id);
  ctx.soon();
};

/** @type {Reducer} */
const gone = (ctx, env, d, tid, type) => {
  if (typeof d.id !== "string") return rejectFrame(ctx, type, "id");
  ctx.state.gone.set(d.id, { state: type === "review.withdrawn" ? "withdrawn" : "expired", reason: text(d.reason) || null, why: text(d.why) || "", at: Date.now() });
  if (ctx.state.gone.size > 200) {
    const oldest = ctx.state.gone.keys().next();
    if (!oldest.done) ctx.state.gone.delete(oldest.value);
  }
  closed(ctx, env, d, tid, type);
};

/** @type {Record<string, Reducer>} */
export const review = {
  "review.opened"(ctx, env, d, tid, type) {
    if (typeof d.id !== "string") return rejectFrame(ctx, type, "id");
    const item = { ...d, id: d.id, state: "open", seq: env.seq ?? undefined };
    if (!isReview(item)) return rejectFrame(ctx, "review.opened", invalidField(item, { id: "", state: "open" }, isReview));
    ctx.state.review.set(d.id, item);
    ctx.soon();
  },
  "review.decided": closed,
  "review.withdrawn": gone,
  "review.expired": gone,
  "review.parked"(ctx, env, d, tid, type) {
    if (typeof d.id !== "string") return rejectFrame(ctx, type, "id");
    const it = ctx.state.review.get(d.id);
    if (it) { ctx.state.review.set(d.id, { ...it, parked: true, expires_at: text(d.expires_at) || it.expires_at }); ctx.soon(); }
  },
  "review.annotated"(ctx, env, d, tid, type) {
    if (typeof d.id !== "string") return rejectFrame(ctx, type, "id");
    const it = ctx.state.review.get(d.id);
    if (typeof d.by !== "string" || typeof d.note !== "string") return rejectFrame(ctx, type, "annotation");
    if (it) {
      const annotation = { ...d, by: d.by, note: d.note };
      ctx.state.review.set(d.id, { ...it, annotations: [...(it.annotations || []), annotation] });
      ctx.soon();
    }
  },
};
