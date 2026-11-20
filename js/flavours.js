// The flavours of XO's palette: Stone (css/tokens.css as it is) and the ones tools/flavours/build.mjs makes from it
// (css/flavours.css). Every grey takes hue (degrees) and chroma (OKLCH); lift moves dark's lightness (+ dimmer, − deeper).
export const STONE = { id: "stone", name: "Stone" };
export const FLAVOURS = [
  { id: "sand", name: "Sand", hue: 75, chroma: 0.012 },
  { id: "slate", name: "Slate", hue: 255, chroma: 0.016 },
  { id: "dusk", name: "Dusk", hue: 265, chroma: 0.007 },
  { id: "harbor", name: "Harbor", hue: 245, chroma: 0.022, lift: 0.06 },
  { id: "plum", name: "Plum", hue: 300, chroma: 0.02, lift: 0.03 },
  { id: "onyx", name: "Onyx", hue: 0, chroma: 0, lift: -0.09 },
];
