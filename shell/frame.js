// @ts-check

// The frame's hidden layers go in place before the app reads the page: Settings last in the main area, the rest after the app.

import { PAGE_REGIONS, MAIN_LAYERS, SHELL_DOCK, SETTINGS, OVERLAYS } from "./overlays.js";

const main = /** @type {HTMLElement} */ (document.getElementById("main")), app = /** @type {HTMLElement} */ (document.getElementById("app"));
const home = /** @type {HTMLElement} */ (document.getElementById("home"));
const dock = /** @type {HTMLElement} */ (document.getElementById("dock"));
home.insertAdjacentHTML("afterend", PAGE_REGIONS);
dock.insertAdjacentHTML("afterend", MAIN_LAYERS);
main.insertAdjacentHTML("afterend", SHELL_DOCK);
main.insertAdjacentHTML("beforeend", SETTINGS);
app.insertAdjacentHTML("afterend", OVERLAYS);
