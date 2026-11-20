// The flavours of XO's palette: Stone (css/tokens.css as it is) and the ones tools/flavours/build.mjs makes from it
// (css/flavours.css). hue in degrees and chroma in OKLCH units: every grey keeps its lightness and takes these.
export const STONE = { id: "stone", name: "Stone" };
export const FLAVOURS = [
  { id: "sand", name: "Sand", hue: 75, chroma: 0.012 },
  { id: "slate", name: "Slate", hue: 255, chroma: 0.016 },
];
