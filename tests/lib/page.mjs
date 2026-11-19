// The page as the browser holds it once the shell has put its hidden layers in: index.html with shell/overlays.js's markup in place.
import { readFileSync } from "node:fs";
import { SETTINGS, OVERLAYS } from "../../shell/overlays.js";

const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
export const pageHtml = () => html.replace("    </main>\n", `${SETTINGS}    </main>\n`).replace('  <script type="module" src="./js/skeleton.js">', `${OVERLAYS}  <script type="module" src="./js/skeleton.js">`);
