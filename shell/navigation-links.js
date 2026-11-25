// @ts-check

/** @import { NavigationLinks } from "./navigation-links-types.d.ts" */

/** @param {NavigationLinks} options */
export function createNavigationLinks({ go, showMsg, openFromPanel, thread, heraldShow }) {
  /** @param {Element} element */
  const rowIn = (element) => element.closest("#msgs > [data-k]")?.getAttribute("data-k") ?? null;
  /** @param {Element} t @param {MouseEvent} e */
  return (t, e) => {
    const link = t.closest("[data-go]");
    const destination = link?.getAttribute("data-go");
    if (link && destination && !t.closest("#stage")) {
      e.preventDefault();
      go(destination, { row: rowIn(link) });
      const message = link.getAttribute("data-go-msg");
      if (message) showMsg(message);
      return true;
    }
    const tl = t.closest("a[data-thread]");
    const threadId = tl?.getAttribute("data-thread");
    if (tl && threadId) {
      e.preventDefault();
      if (thread(threadId)) {
        if (t.closest("#stage")) openFromPanel("t:" + threadId, e);
        else go("t:" + threadId, { row: rowIn(tl) });
      } else heraldShow({ kind: "calm", text: "That thread isn't loaded", sub: "it may be in another project" }, 3200);
      return true;
    }
    return false;
  };
}
