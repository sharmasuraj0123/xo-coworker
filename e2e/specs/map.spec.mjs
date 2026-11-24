// @ts-check

/** @import { Case } from "../lib/types.d.ts" */

const agents = Array.from("abcdef", (id) => ({ id, session: `session-${id}`, file: `${id}.js` }));
const project = { chat_id: "chat_demo" };

/** @param {string} rgb */
function luminance(rgb) {
  const match = /^rgb\((\d+), (\d+), (\d+)\)$/.exec(rgb);
  if (!match) throw new Error(`expected an opaque sRGB colour, got ${rgb}`);
  const [r, g, b] = match.slice(1).map((channel) => {
    const value = Number(channel) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** @type {Omit<Case, "file">[]} */
export const cases = [{
  name: "working agent tags have readable text on every rendered colour",
  seed: {
    threads: {
      chat_demo: agents.map(({ id, session }) => ({
        ts: id, session_id: session, title: `Agent ${id}`, cwd: "/home/test/demo",
      })),
    },
    files: { demo: Object.fromEntries(agents.map(({ file }) => [file, "// fixture\n"])) },
    routes: { "GET /api/xo-projects/demo/github/issues": { repo: null, issues: [] } },
  },
  async run(t) {
    const { page, space } = t;
    await t.open();
    await page.getByRole("navigation", { name: "Projects" }).getByRole("button", { name: "demo" }).click();
    await t.settle();
    await page.locator("[data-stage-toggle]").filter({ visible: true }).click();
    const graph = page.getByRole("tab", { name: "Graph" });
    if (!(await graph.isVisible())) await page.locator('[data-fr-fold="map"]').click();
    await graph.click();

    for (const { id, session, file } of agents) {
      const meta = { ...project, thread_ts: id, session_id: session, turn_id: `turn-${id}` };
      space.push("session", { status: "running", reason: "started" }, meta);
      space.push("turn.started", {}, meta);
      space.push("block.finished", {
        block: { id: `block-${id}`, type: "activity", rows: [
          { call_id: `edit-${id}`, kind: "edit_file", status: "running", target: file },
        ] },
      }, meta);
    }

    const colours = new Set();
    await page.keyboard.press("Tab");
    for (const { id } of agents) {
      const tag = page.locator(`.dg-cur:not(.is-stacked) .dg-tag[data-mp-go="t:${id}"]`);
      await tag.waitFor({ state: "visible" });
      await tag.focus();
      await page.waitForFunction((/** @type {string} */ thread) => {
        const el = document.querySelector(`.dg-tag[data-mp-go="t:${thread}"]`);
        return el === document.activeElement && getComputedStyle(/** @type {Element} */ (el)).opacity === "1";
      }, id);
      const { color, background } = await tag.evaluate((/** @type {Element} */ el) => {
        const css = getComputedStyle(el);
        return { color: css.color, background: css.backgroundColor };
      });
      colours.add(background);
      const ink = luminance(color), fill = luminance(background);
      const contrast = (Math.max(ink, fill) + 0.05) / (Math.min(ink, fill) + 0.05);
      if (contrast < 4.5) t.fail(`Agent ${id}: ${color} on ${background} has ${contrast.toFixed(2)}:1 contrast; expected 4.5:1`);
    }
    if (colours.size !== agents.length) t.fail(`Expected six distinct rendered fills, got ${[...colours].join("; ")}`);
  },
}];
