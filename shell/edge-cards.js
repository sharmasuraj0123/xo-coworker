// @ts-check

/** @typedef {{ park(): void; unpark(): void }} Card */

/** @param {() => Card & { isOpen(): boolean }} decisions @param {() => Card & { isOpen: boolean }} viewer */
export function createEdgeCards(decisions, viewer) {
  /** @type {Card | null} */
  let covered = null;
  /** @param {Card} card @param {boolean} open */
  function cover(card, open) {
    if (open) { card.park(); covered = card; }
  }
  /** @param {Card} card */
  function restore(card) {
    if (covered !== card) return;
    covered = null;
    card.unpark();
  }
  return {
    decisionOpened() { const card = viewer(); cover(card, card.isOpen); },
    decisionClosed() { restore(viewer()); },
    fileOpened() { const card = decisions(); cover(card, card.isOpen()); },
    fileClosed() { restore(decisions()); },
  };
}
