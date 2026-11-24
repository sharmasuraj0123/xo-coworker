// @ts-check

import { $ } from "../../core/platform/dom.js";

/** @param {{ sound: typeof import("../../core/services/sound.js").sound, announce: (message: string) => void }} options */
export function wireSound({ sound, announce }) {
  /** @param {string | null} [said] */
  function soundRender(said = null) {
    const tog = $("#sound-tog");
    tog.setAttribute("aria-checked", String(sound.on));
    const row = tog.closest(".set-row");
    let note = row && row.nextElementSibling && row.nextElementSibling.matches(".sound-note") ? row.nextElementSibling : null;
    if (said == null) { note?.remove(); return; }
    if (!note && row) { note = document.createElement("p"); note.className = "set-note sound-note"; note.setAttribute("role", "status"); row.after(note); }
    if (note) note.textContent = said;
  }

  $("#sound-tog").addEventListener("click", async () => {
    const tog = $("#sound-tog");
    if (tog.getAttribute("aria-busy") === "true") return;
    tog.setAttribute("aria-busy", "true");
    const want = !sound.on;
    const r = await sound.turn(want);
    tog.removeAttribute("aria-busy");
    const said = r.refused ? "This browser won't play sound here, so sounds stay off."
      : r.kept ? null
      : want ? "This browser won't remember sounds here, so they stay off."
      : "Sounds are off for now: this browser won't remember it after a reload.";
    soundRender(said);
    if (said) announce(said);
    if (r.on) sound.play("allow");
  });

  return soundRender;
}
