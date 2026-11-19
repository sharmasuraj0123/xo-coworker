// The sidebar and Home at rest, on a desktop and a phone; Settings opens and closes.
export const cases = [
  {
    name: "home at rest, desktop", seed: "basic",
    async run(t) {
      await t.open();
      await t.snap("navigation", t.page.getByRole("complementary", { name: "Navigation" }));
      await t.snap("main", t.page.getByRole("main"));
    },
  },
  {
    name: "home at rest, phone", seed: "basic", viewport: "phone",
    async run(t) {
      await t.open();
      await t.snap("main", t.page.getByRole("main"));
    },
  },
  {
    name: "settings opens as a dialog and Escape gives focus back", seed: "basic",
    async run(t) {
      const { page } = t;
      await t.open();
      const opener = page.getByRole("complementary", { name: "Navigation" }).getByRole("button", { name: "Settings" });
      await opener.click();
      await t.settle();
      await t.snap("settings", page.getByRole("dialog"));
      await page.keyboard.press("Escape");
      await t.settle();
      if (await page.getByRole("dialog").count()) t.fail("Escape left the settings dialog open");
      const focus = await page.evaluate(() => { const a = document.activeElement; return a === document.body ? "BODY" : `${a.tagName} ${a.getAttribute("aria-label") || a.textContent.trim()}`; });
      if (focus !== "BUTTON Settings") t.fail(`focus after Escape is on ${focus}, not the Settings button that opened it`);
    },
  },
];
