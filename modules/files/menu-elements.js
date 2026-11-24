// @ts-check

import { ICON } from "../../core/ui/icons/names.js";

export function createFilesMenu() {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "fl-more";
  button.title = "More: new, rename, delete, copy path";
  button.setAttribute("data-own", "");
  button.setAttribute("aria-haspopup", "menu");
  button.setAttribute("aria-expanded", "false");
  button.innerHTML = ICON.more;

  const menu = document.createElement("div");
  menu.className = "fl-menu";
  menu.setAttribute("role", "menu");
  menu.hidden = true;
  return { button, menu };
}
