// @ts-check
import { api } from "../../core/platform/api.js";
import { createGhPage } from "./page.js";

/** @import { GithubPageOptions } from "./types" */

/** @typedef {Pick<GithubPageOptions, "stage" | "view"> & { projectOf(view: string): string | null, announce(text: string): void }} Host */

/** @typedef {Pick<import("../../core/kernel/types").ModuleContext, "frame" | "effect">} Scope */

/** @param {Scope} scope @param {Host} host @param {(view: string) => void} go @param {(text: string) => void} compose */
export function mountGithubPage(scope, host, go, compose) {
  const page = createGhPage({
    ...host, api, projectOf: (view) => host.projectOf(view) ?? "",
    work(project, item) {
      const view = "p:" + project;
      if (host.view() !== view) go(view);
      const what = item.kind === "pr" ? "Review pull request #" : "Work on issue #";
      scope.frame(() => {
        compose(`${what}${item.number}, “${item.title}”: ${item.url}`);
        host.announce("The ask is in the message box. Send it to start a thread.");
      });
    },
  });
  scope.effect(() => page.dispose);
  return {
    show: page.show, leave: page.leave,
    has(/** @type {string} */ view) {
      const project = host.projectOf(view);
      return project && project !== "workspace" ? page.has(project) : Promise.resolve(false);
    },
  };
}
