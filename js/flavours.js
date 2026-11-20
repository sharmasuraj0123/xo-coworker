// The flavours of XO's palette: Stone (css/tokens.css as it is) and the ones tools/flavours/build.mjs makes from it
// (css/flavours.css). Every grey takes hue (degrees) and chroma (OKLCH), words ink × that chroma; lift moves the
// surfaces' lightness (dark: + dimmer, − deeper; light: − a darker paper). light: the light mode's own settings.
export const STONE = { id: "stone", name: "Stone" };
export const FLAVOURS = [
  { id: "sand", name: "Sand", hue: 75, chroma: 0.012 },
  { id: "slate", name: "Slate", hue: 255, chroma: 0.016 },
  { id: "dusk", name: "Dusk", hue: 265, chroma: 0.007 },
  { id: "harbor", name: "Harbor", hue: 245, chroma: 0.022, lift: 0.06 },
  { id: "plum", name: "Plum", hue: 300, chroma: 0.02, lift: 0.03 },
  { id: "onyx", name: "Onyx", hue: 0, chroma: 0, lift: -0.09 },
  { id: "tide", name: "Tide", hue: 220, chroma: 0.04, lift: 0.03, ink: 0.3, light: { hue: 90, chroma: 0.03 } },
  { id: "ember", name: "Ember", hue: 65, chroma: 0.022, lift: 0.05, ink: 0.6, light: { hue: 88, chroma: 0.04, lift: -0.008, ink: 0.5 } },
  { id: "rose", name: "Rose", hue: 295, chroma: 0.03, lift: 0.02, ink: 0.5, light: { hue: 55, chroma: 0.016, lift: -0.01 } },
  { id: "moss", name: "Moss", hue: 200, chroma: 0.016, lift: 0.07, ink: 0.5, light: { hue: 95, chroma: 0.03 } },
  { id: "washi", name: "Washi", hue: 285, chroma: 0.016, lift: 0.02, ink: 0.4, light: { hue: 100, chroma: 0.035, lift: -0.008, ink: 0.5 } },
  { id: "deep", name: "Deep", hue: 255, chroma: 0.022, lift: -0.05, ink: 0.4, light: { hue: 80, chroma: 0.006 } },
  { id: "midnight", name: "Midnight", hue: 245, chroma: 0.045, lift: -0.03, ink: 0.3, light: { hue: 245, chroma: 0.008 } },
  { id: "cinder", name: "Cinder", hue: 330, chroma: 0.008, lift: 0.07, ink: 0.5, light: { hue: 60, chroma: 0.008 } },
];
