import { readFileSync } from "node:fs";
import { dom } from "./dom.mjs";

export const bootPage = () => dom(readFileSync(new URL("../../index.html", import.meta.url), "utf8"), { wholeDocument: true });
