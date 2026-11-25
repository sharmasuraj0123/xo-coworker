// @ts-check

/** @typedef {{ id: string, count(): number }} RailCount */

/** @type {import("../../core/kernel/types").ModuleDef} */
export const railCountsModule = {
  manifest: { id: "xo.rail-counts", version: "1.0.0", kernel: "^1.1.0", core: true, needs: ["world"] },
  activate(ctx) {
    const world = ctx.use("world");
    const rows = Array.from(document.querySelectorAll("[data-rail-count]")).map((badge) => ({
      badge, row: badge.closest("[data-go]"), label: badge.parentElement?.querySelector(".nr-name")?.textContent ?? "",
    }));
    function paint() {
      for (const { badge, row, label } of rows) {
        if (!row) continue;
        /** @type {RailCount | undefined} */
        const source = ctx.places.get("rail.count", row.getAttribute("data-go") ?? "");
        const count = world.state.loaded ? source?.count() ?? 0 : 0;
        const text = count ? String(count) : "";
        if (badge.textContent !== text) badge.textContent = text;
        row.setAttribute("aria-label", text ? label + ", " + text : label);
      }
    }
    ctx.places.watch("rail.count", paint);
    ctx.on("app:render", paint);
    paint();
  },
};
