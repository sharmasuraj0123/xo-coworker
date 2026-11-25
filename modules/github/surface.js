// @ts-check
import { api } from "../../core/platform/api.js";
import { ICON } from "../../core/ui/icons/names.js";
import { createGhPage } from "./page.js";

/** @type {import("../../core/kernel/types").ModuleDef} */
export const githubModule = {
  manifest: { id: "xo.github", version: "1.0.0", kernel: "^1.1.0",
    needs: ["stage", "currentView", "placeContext", "announce", "navigation"],
    contributes: ["panel.page:github", "panel.page:ghitem", "panel.title-action:github"] },
  activate(ctx) {
    const stage = ctx.use("stage"), view = ctx.use("currentView"), announce = ctx.use("announce");
    const { atOf } = ctx.use("placeContext"), { go } = ctx.use("navigation");
    const page = createGhPage({
      api, view, announce, projectOf: (v) => atOf(v).project ?? "",
      stage: {
        show: stage.show, get pageShown() { return stage.pageShown; },
        page(id, entry) { ctx.contribute("panel.page", { id, ...entry }); },
      },
      work(project, item) {
        const destination = "p:" + project;
        if (view() !== destination) go(destination);
        const what = item.kind === "pr" ? "Review pull request #" : "Work on issue #";
        ctx.frame(() => {
          ctx.emit("app:compose-text", `${what}${item.number}, “${item.title}”: ${item.url}`);
          announce("The ask is in the message box. Send it to start a thread.");
        });
      },
    });
    ctx.effect(() => page.dispose);
    /** @type {import("../../shell/panel/panel-types").PanelTitleAction} */
    const action = {
      id: "github", label: "Issues and pull requests", icon: ICON.github,
      init(button) { button.dataset.openGh = ""; button.hidden = true; button.setAttribute("aria-pressed", "false"); },
      onPress() { if (page.isOpen) stage.dropPages(); else page.show(); },
      leave: page.leave,
      async sync(button, current, shown) {
        const selected = shown === "github" || shown === "ghitem";
        button.setAttribute("aria-pressed", String(selected));
        button.classList.toggle("is-on", selected);
        const project = atOf(current).project;
        const available = !!project && project !== "workspace" && await page.has(project);
        if (!ctx.signal.aborted && view() === current) button.hidden = !available;
      },
    };
    ctx.contribute("panel.title-action", action);
    ctx.emit("app:render");
  },
};
