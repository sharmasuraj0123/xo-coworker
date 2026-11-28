// @ts-check

/** @import { EdgeCard, EdgeName } from "./edge-card-types" */

/** @type {import("../core/kernel/types").ModuleDef} */
export const edgeCardsModule = {
  manifest: { id: "xo.edge-cards", version: "1.0.0", kernel: "^1.1.0", core: true, provides: ["edgeCards"] },
  activate(ctx) {
    /** @type {Map<EdgeName, EdgeCard>} */
    const cards = new Map();
    /** @type {{ by: EdgeName; card: EdgeCard } | undefined} */
    let covered;
    /** @param {EdgeName} name */
    const close = (name) => {
      if (covered?.by !== name) return;
      const { card } = covered;
      covered = undefined;
      card.unpark();
    };
    ctx.on("app:card-opened", (name) => {
      const other = cards.get(name === "decisions" ? "files" : "decisions");
      if (other?.isOpen()) { other.park(); covered = { by: name, card: other }; }
    });
    ctx.on("app:card-closed", close);
    ctx.provide("edgeCards", {
      register(name, card) {
        cards.set(name, card);
        return () => {
          if (cards.get(name) !== card) return;
          cards.delete(name);
          if (covered?.card === card) covered = undefined;
          close(name);
        };
      },
    });
  },
};
