// @ts-check

// Recently made on Home: the strip of what threads made last.

/** @param {{ homeMade: (box: HTMLElement) => void }} rec */
export const madeSection = (rec) => ({
  id: "hm-made", order: 20, mount() {},
  render: (/** @type {HTMLElement} */ el) => rec.homeMade(el),
});
