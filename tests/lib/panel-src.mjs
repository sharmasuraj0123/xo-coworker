// The panel's source, every file of shell/panel in one text, for the tests that read it.
import { readFileSync } from "node:fs";

export const PANEL_FILES = ["panel.js", "pages.js", "frames.js", "width.js", "lists.js"].map((f) => `shell/panel/${f}`);
export const panelSrc = PANEL_FILES.map((f) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8")).join("\n");
