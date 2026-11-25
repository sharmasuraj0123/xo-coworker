// @ts-check

/** @param {import("../core/kernel/types").ModuleContext} ctx */
export function mountReleaseNotice(ctx) {
  const version = document.querySelector('meta[name="xo-ui-version"]')?.getAttribute("content");
  if (!version) return;
  const prefix = location.origin + "/v/" + version + "/";
  const wrapper = document.createElement("div");
  wrapper.className = "toast";
  wrapper.setAttribute("role", "status");
  const label = document.createElement("span");
  const reload = document.createElement("button");
  reload.className = "btn";
  reload.type = "button";
  reload.textContent = "Reload";
  wrapper.append(label, reload);
  ctx.listen(reload, "click", () => location.reload());
  ctx.effect(() => () => wrapper.remove());
  let checking = false, failed = false, updated = false;
  function show() {
    if (ctx.signal.aborted || (!updated && !failed)) return;
    label.textContent = updated ? "XO was updated." : "Part of XO couldn’t load.";
    if (!wrapper.isConnected) document.querySelector(".toast-wrap")?.append(wrapper);
  }
  async function check() {
    if (checking || updated || ctx.signal.aborted || document.visibilityState === "hidden") return;
    checking = true;
    try {
      const response = await fetch("/", { method: "HEAD", cache: "no-store", signal: ctx.signal });
      const latest = response.headers.get("X-XO-UI-Version");
      updated = response.ok && !!latest && latest !== version;
    } catch {
      return;
    } finally {
      checking = false;
      show();
    }
  }
  function assetFailed() {
    failed = true;
    show();
    void check();
  }
  ctx.listen(window, "error", ({ target }) => {
    if (!(target instanceof Element)) return;
    const ref = target.getAttribute("src") ?? target.getAttribute("href");
    if (ref && new URL(ref, document.baseURI).href.startsWith(prefix)) assetFailed();
  }, true);
  if (typeof PerformanceObserver !== "undefined" && PerformanceObserver.supportedEntryTypes.includes("resource")) {
    const observer = new PerformanceObserver(list => {
      for (const item of list.getEntries()) {
        if (item.name.startsWith(prefix) && "responseStatus" in item && Number(item.responseStatus) >= 400) assetFailed();
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
