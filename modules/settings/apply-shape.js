// @ts-check

/** @param {import("./apply-shape-types.d.ts").ShapeApplyDeps} options */
export function createShapeApply({ view, SV, SHAPE, setWorkMode, hopsRender, webpicsRender, convThread, world, loadChatHops, SH, STAGE, schedule }) {
  return function shapeApply({ boot = false } = {}) {
    SV.apply();
    setWorkMode(SHAPE.opts("xo:thread/work").mode);
    hopsRender();
    webpicsRender();
    if (boot) return; // the first render draws the rest
    if (SHAPE.on("xo:thread/hops")) { const current = view(), t = convThread(current); if (t) world.act.loadHops?.(t.id); else loadChatHops(current); }
    SH.redraw();
    STAGE.reshape();
    schedule();
  };
}
