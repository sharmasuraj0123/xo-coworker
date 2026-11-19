// @ts-check

// The frame's hidden layers go in place before the app reads the page: Settings last in the main area, the rest after the app.

import { SETTINGS, OVERLAYS } from "./overlays.js";

const main = /** @type {HTMLElement} */ (document.getElementById("main")), app = /** @type {HTMLElement} */ (document.getElementById("app"));
main.insertAdjacentHTML("beforeend", SETTINGS);
app.insertAdjacentHTML("afterend", OVERLAYS);
