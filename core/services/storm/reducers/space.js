// @ts-check

/** @typedef {import("../types").Reducer} Reducer */

/** @type {Reducer} */
const file = (ctx, env, d, tid, type) => { ctx.event({ kind: "file", type, data: d }); };

/** @type {Record<string, Reducer>} */
export const space = {
  // a file changed on disk (Space's watcher and version store): the open file takes it in
  "file.version": file,
  "file.version.attributed": file,
  "file.rescan": file,
  // creation: the hop without its note; a state move: {id, state}
  hop(ctx, env, d) {
    const old = ctx.state.hops.get(d.id);
    if (old || d.kind) { ctx.putHop(d, { seq: (old && old.seq) ?? env.seq ?? null, at: (old && old.at) || env.ts }); ctx.emitSoon(); }
    // a move for a hop not read yet (a cold load, its history still on the way) is held for it
    else if (d.id && d.state) ctx.holdMove(d.id, d.state);
    // the open thread shows what its hops say: read the new one's note
    if (d.kind && d.thread_ts && ctx.isWatched(d.thread_ts)) ctx.hopsSoon(d.thread_ts);
  },
  chat(ctx, env, d) {
    const { state, chatProject } = ctx;
    // a creation carries `kind`: add it from the event, no re-listing
    if (d.kind) {
      if (!chatProject.has(d.id)) {
        const id = d.kind === "workspace" ? "workspace" : d.project;
        chatProject.set(d.id, id);
        if (!state.projects.some((p) => p.chatId === d.id)) state.projects.push({ id, name: d.kind === "workspace" ? "Workspace" : d.project, kind: d.kind, chatId: d.id, routing: null, pin: { agent: null, model: null, effort: null }, hasChat: true });
        ctx.soon();
      }
      return;
    }
    if (d.retired_at) { ctx.loadChats(); return; }
    const p = state.projects.find((x) => x.chatId === d.id);
    if (p) { for (const k of ["routing", "agent", "model", "effort"]) if (k in d) { if (k === "routing") p.routing = d.routing; else p.pin = { ...(p.pin || {}), [k]: d[k] }; } }
    ctx.emit();
  },
  settings(ctx, env, d) {
    if (d.key === "router") { ctx.state.router = d.value; ctx.emit(); }
    // the person's shape changed on a device (this one's own write echoes too): the shape store decides
    else if (d.key === "ui.shape") ctx.event({ kind: "shape", value: d.value ?? null });
  },
  pool(ctx, env, d) {
    const { state } = ctx;
    if (!d.pool) return;
    const fresh = !(d.pool in state.pools);
    const sig = ctx.poolsSig();
    state.pools[d.pool] = { ...(state.pools[d.pool] || {}), ...d };
    if (ctx.poolsSeen && fresh) ctx.refreshRuntimes();
    if (ctx.poolsSig() !== sig) ctx.soon(); else ctx.emit();
  },
};
