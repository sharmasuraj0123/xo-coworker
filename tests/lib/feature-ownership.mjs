import assert from "node:assert/strict";

export async function checkFeatureOwnership(kernel, press, flushFrames) {
  const entries = (id) => kernel.places.entries("conversation.press").filter((entry) => entry.owner === id);
  const ownership = [
    ["xo.home", ["next"]],
    ["xo.transcript", ["older", "fold", "checklist", "interrupt"]],
    ["xo.thread-actions", ["thread-menu"]],
    ["xo.chat-controls", ["chat-message"]],
    ["xo.create-project", ["create"]],
  ];
  for (const [id, expected] of ownership) {
    const first = entries(id);
    assert.deepEqual(first.map((entry) => entry.id).sort(), expected.toSorted(), id);
    const opener = document.querySelector("#side-add");
    const remove = opener.removeEventListener;
    let unbound = 0;
    opener.removeEventListener = function (type, ...args) {
      if (type === "click") unbound++;
      return remove.call(this, type, ...args);
    };
    try { await kernel.disable(id); } finally { opener.removeEventListener = remove; }
    assert.equal(entries(id).length, 0, `retiring ${id} removes its controls`);
    if (id === "xo.create-project") {
      assert.equal(unbound, 1, "Create releases the sidebar opener");
      press("#side-add");
      assert.ok(!document.querySelector("#create-dlg").open);
    }
    if (id === "xo.home") assert.equal(document.querySelector("#home").childElementCount, 0);
    await kernel.enable(id);
    flushFrames();
    const replacement = entries(id);
    assert.deepEqual(replacement.map((entry) => entry.id).sort(), expected.toSorted(), id);
    assert.ok(replacement.every((entry) => !first.includes(entry)));
    if (id === "xo.home") assert.equal(document.querySelectorAll("#hm-body").length, 1);
  }
  const githubControl = () => document.querySelector("#stage [data-open-gh]");
  const previous = githubControl();
  assert.ok(previous);
  assert.equal(kernel.places.get("panel.page", "ghitem")?.owner, "xo.github");
  await kernel.disable("xo.github");
  assert.equal(githubControl(), null);
  assert.equal(kernel.places.get("panel.page", "github"), undefined);
  await kernel.enable("xo.github");
  assert.equal(document.querySelectorAll("#stage [data-open-gh]").length, 1);
  assert.ok(githubControl() !== previous);
  const jump = document.querySelector("#jump");
  press("#side-jump");
  assert.equal(jump.hidden, false);
  await kernel.disable("xo.jump");
  assert.equal(jump.hidden, true);
  press("#side-jump");
  assert.equal(jump.hidden, true);
  await kernel.enable("xo.jump");
  press("#side-jump");
  assert.equal(jump.hidden, false);
  press("#side-jump");
}
