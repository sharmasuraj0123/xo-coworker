// @ts-check

/** @typedef {{ id: string, name: string, hue: number, chroma: number, lift?: number, primary?: string, ink?: number, light?: { hue: number, chroma: number, lift?: number, ink?: number } }} Flavour */
export const STONE = { id: "stone", name: "Stone" };
/** @type {Flavour[]} */
export const FLAVOURS = [
  { id: "sand", name: "Sand", hue: 75, chroma: 0.012 },
  { id: "slate", name: "Slate", hue: 255, chroma: 0.016, primary: "ink" },
  { id: "dusk", name: "Dusk", hue: 265, chroma: 0.007, primary: "ink" },
  { id: "harbor", name: "Harbor", hue: 245, chroma: 0.022, lift: 0.06 },
  { id: "plum", name: "Plum", hue: 300, chroma: 0.02, lift: 0.03 },
  { id: "onyx", name: "Onyx", hue: 0, chroma: 0, lift: -0.08, primary: "ink" },
  { id: "tide", name: "Tide", hue: 220, chroma: 0.04, lift: 0.03, ink: 0.3, light: { hue: 90, chroma: 0.03 } },
  { id: "ember", name: "Ember", hue: 65, chroma: 0.022, lift: 0.05, ink: 0.6, light: { hue: 88, chroma: 0.04, lift: -0.008, ink: 0.5 } },
  { id: "rose", name: "Rose", hue: 295, chroma: 0.03, lift: 0.02, ink: 0.5, light: { hue: 55, chroma: 0.016, lift: -0.01 } },
  { id: "moss", name: "Moss", hue: 200, chroma: 0.016, lift: 0.07, ink: 0.5, light: { hue: 95, chroma: 0.03 } },
  { id: "washi", name: "Washi", hue: 285, chroma: 0.016, lift: 0.02, ink: 0.4, light: { hue: 100, chroma: 0.035, lift: -0.008, ink: 0.5 } },
  { id: "deep", name: "Deep", hue: 255, chroma: 0.022, lift: -0.05, ink: 0.4, light: { hue: 80, chroma: 0.006 }, primary: "ink" },
  { id: "midnight", name: "Midnight", hue: 245, chroma: 0.045, lift: -0.03, ink: 0.3, light: { hue: 245, chroma: 0.008 }, primary: "ink" },
  { id: "cinder", name: "Cinder", hue: 330, chroma: 0.008, lift: 0.07, ink: 0.5, light: { hue: 60, chroma: 0.008 } },
];

/** @param {"light" | "dark"} theme @param {string} flavour */
export function canvasColor(theme, flavour) {
  return (CANVAS_COLORS.get(flavour) ?? STONE_CANVAS)[theme];
}
// Generated canvas colours begin.
const STONE_CANVAS = { dark: "#141414", light: "#FAFAFA" };
const CANVAS_COLORS = new Map([
  ["stone", STONE_CANVAS],
  ["sand", { dark: "#17130E", light: "#FFF9F2" }],
  ["slate", { dark: "#0F141B", light: "#F7FAFF" }],
  ["dusk", { dark: "#121417", light: "#F8FAFF" }],
  ["harbor", { dark: "#19232C", light: "#F6FBFF" }],
  ["plum", { dark: "#1C1923", light: "#FBF9FF" }],
  ["onyx", { dark: "#050505", light: "#FAFAFA" }],
  ["tide", { dark: "#001F28", light: "#FFFAEC" }],
  ["ember", { dark: "#271D14", light: "#FFF7E4" }],
  ["rose", { dark: "#191625", light: "#FFF5EE" }],
  ["moss", { dark: "#1B2727", light: "#FFFAE8" }],
  ["washi", { dark: "#181820", light: "#FDF9DE" }],
  ["deep", { dark: "#040A12", light: "#FCFAF6" }],
  ["midnight", { dark: "#000F1E", light: "#F6FBFF" }],
  ["cinder", { dark: "#272326", light: "#FEF9F5" }],
]);
// Generated canvas colours end.
