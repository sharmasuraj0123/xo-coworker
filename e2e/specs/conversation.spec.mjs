// A project opens on its conversation; a message sent from the composer is posted once and shown.
const openDemo = async (t) => {
  await t.open();
  await t.page.getByRole("navigation", { name: "Projects" }).getByRole("button", { name: "demo" }).click();
  await t.settle();
};

export const cases = [
  {
    name: "a project opens on its conversation", seed: "basic",
    async run(t) {
      await openDemo(t);
      await t.snap("main", t.page.getByRole("main"));
    },
  },
  {
    name: "send a message from the composer", seed: "basic",
    async run(t) {
      await openDemo(t);
      const box = t.page.getByRole("textbox", { name: "Message demo…" });
      await box.fill("Please add a licence");
      await t.page.keyboard.press("Enter");
      await t.settle();
      const posts = t.store.writes.filter((w) => w.method === "POST" && w.path === "/api/chat/chats/chat_demo/messages");
      if (posts.length !== 1 || posts[0].body.text !== "Please add a licence") t.fail(`expected one post of the text, got ${JSON.stringify(posts)}`);
      if ((await box.inputValue()) !== "") t.fail("the composer wasn't emptied after sending");
      await t.snap("messages", t.page.getByRole("log", { name: "Messages" }));
      await t.snap("status", t.page.getByRole("main").getByRole("status"));
    },
  },
];
