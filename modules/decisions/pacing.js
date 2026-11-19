// @ts-check

// Attention rules, applied invisibly: small asks wait while their agent works, only big new ones ping, and a break after ~25 minutes.

export const SMALL_MIN = 30;
export const PING_MIN = 60;

/** @typedef {{ key: string, risk?: string, group?: string, idle?: boolean, lev: { min: number }, bypass?: boolean, held?: boolean, heldWhy?: string, admitted?: boolean }} Paced */

/** @param {{ params?: unknown }} [_] */
export function createPacing(_ = {}) {
  const S = {
    pingMin: PING_MIN,
    vigilMin: 25,
    reviewMs: 0,
    reviewFrom: 0,
    vigilAckAt: -1,
    /** @type {Set<string>} */
    brought: new Set(),
    /** @type {Set<string>} */
    pinged: new Set(),
  };
  /** @param {Paced} n */
  const bypass = (n) => n.risk === "destructive" || n.group === "stopped";

  /** @template {Paced} T @param {T[]} needs */
  function classify(needs) {
    for (const n of needs) {
      n.bypass = bypass(n);
      n.held = false; n.heldWhy = "";
      if (!n.bypass && !S.brought.has(n.key) && !n.idle && n.lev.min < SMALL_MIN) {
        n.held = true;
        n.heldWhy = "Small, and its agent works around it.";
      }
      n.admitted = !n.held;
    }
    return needs;
  }

  return {
    S,
    classify,
    isBypass: bypass,
    /** @param {string} key */
    bringIn(key) { S.brought.add(key); },
    /** @param {Paced} n */
    mayPing(n) {
      if (S.pinged.has(n.key) || n.held || n.lev.min < S.pingMin) return false;
      S.pinged.add(n.key);
      return true;
    },
    reviewStart() { if (!S.reviewFrom) S.reviewFrom = Date.now(); },
    reviewStop() { if (S.reviewFrom) { S.reviewMs += Date.now() - S.reviewFrom; S.reviewFrom = 0; } },
    reviewMin() { return (S.reviewMs + (S.reviewFrom ? Date.now() - S.reviewFrom : 0)) / 60000; },
    tired() {
      const m = this.reviewMin();
      return m >= S.vigilMin && (S.vigilAckAt < 0 || m - S.vigilAckAt >= 15);
    },
    keepGoing() { S.vigilAckAt = this.reviewMin(); },
    rested() { this.reviewStop(); S.reviewMs = 0; S.vigilAckAt = -1; },
  };
}
