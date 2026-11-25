// @ts-check

const notified = new WeakSet();

/** @param {import("../core/kernel/types").ModuleContext} ctx */
export function mountReleaseNotice(ctx) {
  const version = document.querySelector('meta[name="xo-ui-version"]')?.getAttribute("content");
  if (!version || notified.has(document)) return;
  const prefix = location.origin + "/v/" + version + "/";
  const notices = ctx.use("notices");
  const mid = "system:ui-update";
  ctx.effect(() => () => notices.drop(mid));
  let checking = false;
  function show() {
    if (ctx.signal.aborted || notified.has(document)) return;
    notified.add(document);
    notices.show({ mid, kind: "calm", force: true, text: "XO was updated", undoLabel: "Reload", undo: () => location.reload() }, 30000);
  }
  async function check() {
    if (checking || notified.has(document) || ctx.signal.aborted || document.visibilityState === "hidden") return;
    checking = true;
    try {
      const response = await fetch("/", { method: "HEAD", cache: "no-store", signal: ctx.signal });
      const latest = response.headers.get("X-XO-UI-Version");
      if (response.ok && latest && latest !== version) show();
    } catch {
      return;
    } finally {
      checking = false;
    }
  }
  ctx.listen(window, "error", ({ target }) => {
    if (!(target instanceof Element)) return;
    const ref = target.getAttribute("src") ?? target.getAttribute("href");
    if (ref && new URL(ref, document.baseURI).href.startsWith(prefix)) show();
  }, true);
  if (typeof PerformanceObserver !== "undefined" && PerformanceObserver.supportedEntryTypes.includes("resource")) {
    const observer = new PerformanceObserver(list => {
      for (const item of list.getEntries()) {
        if (item.name.startsWith(prefix) && "responseStatus" in item && Number(item.responseStatus) >= 400) show();
      }
    });
    observer.observe({ type: "resource", buffered: true });
    ctx.observe(observer);
  }
  ctx.listen(document, "visibilitychange", check);
  ctx.listen(window, "online", check);
  ctx.listen(window, "pageshow", check);
  ctx.interval(check, 60000);
}
