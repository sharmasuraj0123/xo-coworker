// @ts-check

/** @import {SectionContext, SinceNeed} from "./model-types" */

/** @param {{ homeSinceLines: (needs: SinceNeed[]) => string }} service */
export function sinceSection(service) {
  return {
    id: "hm-since",
    order: 10,
    mount() {},
    /** @param {HTMLElement} el @param {SectionContext} context */
    render(el, context) {
      context.patch(el, service.homeSinceLines(context.needs));
    },
  };
}
