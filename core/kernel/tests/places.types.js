// @ts-check

/** @param {import("../types").ModuleContext} ctx */
export function workspacePlaceTypes(ctx) {
  ctx.contribute("workspace.paint", { id: "records", paint(needs) { return needs.map((n) => n.t.id); } });
  ctx.places.get("rail.count", "artifacts")?.count().toFixed();
  // @ts-expect-error Page owners must provide a renderer.
  ctx.contribute("page", { id: "home", mount() {} });
  const paintText = (/** @type {string} */ text) => text;

  // @ts-expect-error A workspace repaint receives decision needs.
  ctx.contribute("workspace.paint", { id: "records", paint: paintText });
  // @ts-expect-error A rail badge provides a count.
  ctx.places.first("rail.count")?.mount();
  ctx.places.first("command")?.run({ project: "demo" }, { title: "Draft" });
  ctx.places.first("files.viewer.kind")?.accepts({ path: "notes.md" }, {});
  // @ts-expect-error File viewers receive a file descriptor.
  ctx.places.first("files.viewer.kind")?.accepts(42, {});
  // @ts-expect-error Shortcut bindings name a command.
  ctx.contribute("shortcut", { id: "draft", keys: "d" });
  // @ts-expect-error Thread menu commands receive a thread.
  ctx.places.first("thread.menu")?.run("thread-id");
}
