// @ts-check

/** @param {import("./apply-shape-types.d.ts").ShapeApplyDeps} options */
export function createShapeApply({ S, SV, SHAPE, setWorkMode, hopsRender, webpicsRender, convThread, world, loadChatHops, SH, STAGE, schedule }) {
  return function shapeApply({ boot = false } = {}) {
    SV.apply();
    setWorkMode(SHAPE.opts("xo:thread/work").mode);
    hopsRender();
    webpicsRender();
    if (boot) return; // the first render draws the rest
    if (S.showHops) { const t = convThread(S.view); if (t && world.act.loadHops) world.act.loadHops(t.id); else if (!t) loadChatHops(S.view); }
    SH.redraw();
    STAGE.reshape();
    schedule();
  };
}
