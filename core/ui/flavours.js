// @ts-check

/** @typedef {Record<"bg" | "fg" | "accent" | "go" | "info" | "warn" | "err" | "violet", string> & { look?: object }} Palette */

/** @typedef {{ id: string, name: string, after: string, dark: Palette, light: Palette }} Flavour */
export const STONE = { id: "stone", name: "Stone" };
/** @type {Flavour[]} */
export const FLAVOURS = [
  { id: "fjord", name: "Aurora", after: "Nord",
    dark: { bg: "#2E3440", fg: "#ECEFF4", accent: "#88C0D0", go: "#A3BE8C",
        info: "#81A1C1", warn: "#EBCB8B", err: "#BF616A", violet: "#B48EAD" },
    light: { bg: "#ECEFF4", fg: "#2E3440", accent: "#5E81AC", go: "#A3BE8C",
        info: "#88C0D0", warn: "#D08770", err: "#BF616A", violet: "#B48EAD" } },
  { id: "nocturne", name: "Nebula", after: "Dracula",
    dark: { bg: "#282A36", fg: "#F8F8F2", accent: "#BD93F9", go: "#50FA7B",
        info: "#8BE9FD", warn: "#FFB86C", err: "#FF5555", violet: "#FF79C6" },
    light: { bg: "#FFFBEB", fg: "#1F1F1F", accent: "#644AC9", go: "#14710A",
        info: "#036A96", warn: "#A34D14", err: "#CB3A2A", violet: "#A3144D" } },
  { id: "solstice", name: "Corona", after: "Solarized",
    dark: { bg: "#002B36", fg: "#93A1A1", accent: "#268BD2", go: "#859900",
        info: "#2AA198", warn: "#B58900", err: "#DC322F", violet: "#6C71C4" },
    light: { bg: "#FDF6E3", fg: "#586E75", accent: "#268BD2", go: "#859900",
        info: "#2AA198", warn: "#B58900", err: "#DC322F", violet: "#6C71C4" } },
  { id: "hearth", name: "Maple", after: "Gruvbox",
    dark: { bg: "#282828", fg: "#EBDBB2", accent: "#FE8019", go: "#B8BB26",
        info: "#83A598", warn: "#FABD2F", err: "#FB4934", violet: "#D3869B" },
    light: { bg: "#FBF1C7", fg: "#3C3836", accent: "#AF3A03", go: "#79740E",
        info: "#076678", warn: "#B57614", err: "#9D0006", violet: "#8F3F71" } },
  { id: "pastel", name: "Pulsar", after: "Catppuccin",
    dark: { bg: "#1E1E2E", fg: "#CDD6F4", accent: "#CBA6F7", go: "#A6E3A1",
        info: "#89B4FA", warn: "#F9E2AF", err: "#F38BA8", violet: "#F5C2E7" },
    light: { bg: "#EFF1F5", fg: "#4C4F69", accent: "#8839EF", go: "#40A02B",
        info: "#1E66F5", warn: "#DF8E1D", err: "#D20F39", violet: "#EA76CB" } },
  { id: "rosewood", name: "Sakura", after: "Rosé Pine",
    dark: { bg: "#191724", fg: "#E0DEF4", accent: "#EBBCBA", go: "#9CCFD8",
        info: "#31748F", warn: "#F6C177", err: "#EB6F92", violet: "#C4A7E7" },
    light: { bg: "#FAF4ED", fg: "#575279", accent: "#D7827E", go: "#56949F",
        info: "#907AA9", warn: "#EA9D34", err: "#B4637A", violet: "#575279" } },
  { id: "neon", name: "Andromeda", after: "Tokyo Night",
    dark: { bg: "#1A1B26", fg: "#C0CAF5", accent: "#7AA2F7", go: "#9ECE6A",
        info: "#7DCFFF", warn: "#E0AF68", err: "#F7768E", violet: "#BB9AF7" },
    light: { bg: "#E1E2E7", fg: "#3760BF", accent: "#2E7DE9", go: "#587539",
        info: "#007197", warn: "#8C6C3E", err: "#F52A65", violet: "#9854F1" } },
  { id: "forest", name: "Sequoia", after: "Everforest",
    dark: { bg: "#2D353B", fg: "#D3C6AA", accent: "#A7C080", go: "#83C092",
        info: "#7FBBB3", warn: "#DBBC7F", err: "#E67E80", violet: "#D699B6" },
    light: { bg: "#FDF6E3", fg: "#5C6A72", accent: "#8DA101", go: "#35A77C",
        info: "#3A94C5", warn: "#DFA000", err: "#F85552", violet: "#DF69BA" } },
  { id: "wave", name: "Doppler", after: "Kanagawa",
    dark: { bg: "#1F1F28", fg: "#DCD7BA", accent: "#957FB8", go: "#98BB6C",
        info: "#7E9CD8", warn: "#FF9E3B", err: "#E46876", violet: "#D27E99" },
    light: { bg: "#F2ECBC", fg: "#545464", accent: "#624C83", go: "#6F894E",
        info: "#4D699B", warn: "#CC6D00", err: "#C84053", violet: "#B35B79" } },
  { id: "atom", name: "Quark", after: "One Dark and One Light",
    dark: { bg: "#282C34", fg: "#ABB2BF", accent: "#61AFEF", go: "#98C379",
        info: "#56B6C2", warn: "#E5C07B", err: "#E06C75", violet: "#C678DD" },
    light: { bg: "#FAFAFA", fg: "#383A42", accent: "#4078F2", go: "#50A14F",
        info: "#0184BC", warn: "#C18401", err: "#E45649", violet: "#A626A4" } },
  { id: "mirage", name: "Nova", after: "Ayu",
    dark: { bg: "#1F2430", fg: "#CCCAC2", accent: "#FFCC66", go: "#D5FF80",
        info: "#73D0FF", warn: "#FFAD66", err: "#F28779", violet: "#DFBFFF" },
    light: { bg: "#FCFCFC", fg: "#5C6166", accent: "#FFAA33", go: "#86B300",
        info: "#399EE6", warn: "#FA8D3E", err: "#F07171", violet: "#A37ACC" } },
  { id: "synth", name: "Plasma", after: "Synthwave '84",
    dark: { bg: "#262335", fg: "#FFFFFF", accent: "#FF7EDB", go: "#72F1B8",
        info: "#36F9F6", warn: "#FEDE5D", err: "#FE4450", violet: "#B893CE" },
    light: { bg: "#FBF7FF", fg: "#2A2139", accent: "#C2359B", go: "#1E9E6A",
        info: "#0E8C9A", warn: "#B8860B", err: "#D7263D", violet: "#7B4FA8" } },
  { id: "onyx", name: "Orcinus", after: "true black (OLED)",
    dark: { bg: "#000000", fg: "#FFFFFF", accent: "#B4A7FF", go: "#7EE0A1",
        info: "#7CC4FF", warn: "#FFC56B", err: "#FF7A85", violet: "#D7A8FF", look: { lift: -0.08 } },
    light: { bg: "#FFFFFF", fg: "#000000", accent: "#5B4BDB", go: "#1F8A4C",
        info: "#0B6BCB", warn: "#A35A00", err: "#C8202F", violet: "#8A3FCF" } },
];

/** @param {"light" | "dark"} theme @param {string} flavour */
export function canvasColor(theme, flavour) {
  return (CANVAS_COLORS.get(flavour) ?? STONE_CANVAS)[theme];
}
// Generated canvas colours begin.
const STONE_CANVAS = { dark: "#141414", light: "#FAFAFA" };
const CANVAS_COLORS = new Map([
  ["stone", STONE_CANVAS],
  ["fjord", { dark: "#2E3440", light: "#ECEFF4" }],
  ["nocturne", { dark: "#282A36", light: "#FEFAEA" }],
  ["solstice", { dark: "#002B36", light: "#FDF6E3" }],
  ["hearth", { dark: "#282828", light: "#FBF1C7" }],
  ["pastel", { dark: "#1E1E2E", light: "#EFF1F5" }],
  ["rosewood", { dark: "#191724", light: "#FAF4ED" }],
  ["neon", { dark: "#1A1B26", light: "#E1E2E7" }],
  ["forest", { dark: "#2D353B", light: "#FDF6E3" }],
  ["wave", { dark: "#1F1F28", light: "#F2ECBE" }],
  ["atom", { dark: "#282C34", light: "#FAFAFA" }],
  ["mirage", { dark: "#1F2430", light: "#FAFAFA" }],
  ["synth", { dark: "#262335", light: "#FBF7FF" }],
  ["onyx", { dark: "#050505", light: "#FAFAFA" }],
]);
// Generated canvas colours end.
