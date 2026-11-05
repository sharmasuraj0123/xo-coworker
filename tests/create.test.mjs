// The new-project dialog (js/create.js): what the Repository field means (as Space reads it) and the folder a
// name makes. Pure, no network.
//   node tests/create.test.mjs
import assert from "node:assert/strict";

globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
const { parseRepo, slugify } = await import("../js/create.js");

let passed = 0;
const t = (name, fn) => {
  try { fn(); passed++; console.log("  ok  " + name); }
  catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; }
};
const gh = (owner, repo) => ({ url: `https://github.com/${owner}/${repo}.git`, label: `${owner}/${repo}`, name: repo, github: true });

t("GitHub: owner/repo, with or without the host, .git or a trailing slash", () => {
  for (const v of ["octocat/Hello-World", "octocat/Hello-World.git", "octocat/Hello-World/", "github.com/octocat/Hello-World",
    "https://github.com/octocat/Hello-World", "https://www.github.com/octocat/Hello-World.git", "http://github.com/octocat/Hello-World/"])
    assert.deepEqual(parseRepo(v), gh("octocat", "Hello-World"), v);
});
t("GitHub: any page of a repo names the repo, as Space reads it", () => {
  for (const v of ["https://github.com/octocat/Hello-World/tree/main/src", "https://github.com/octocat/Hello-World/blob/main/README",
    "https://github.com/octocat/Hello-World/pulls?q=is%3Aopen", "https://github.com/octocat/Hello-World/issues/1", "https://github.com/octocat/Hello-World?tab=readme-ov-file",
    "https://github.com/octocat/Hello-World#readme", "  https://github.com/octocat/Hello-World  "])
    assert.deepEqual(parseRepo(v), gh("octocat", "Hello-World"), v);
});
t("GitHub: a dot in the repo's name stays; only the .git ending goes", () => {
  assert.deepEqual(parseRepo("vercel/next.js"), gh("vercel", "next.js"));
  assert.deepEqual(parseRepo("https://github.com/vercel/next.js/tree/canary"), gh("vercel", "next.js"));
});
t("GitHub's SSH form clones over HTTPS, so the GitHub connection opens it", () => {
  assert.deepEqual(parseRepo("git@github.com:octocat/Hello-World.git"), gh("octocat", "Hello-World"));
});
t("other hosts: HTTPS and SSH go as typed, named by their last part", () => {
  assert.deepEqual(parseRepo("https://gitlab.com/group/sub/proj.git"), { url: "https://gitlab.com/group/sub/proj.git", label: "gitlab.com/group/sub/proj", name: "proj", github: false });
  assert.deepEqual(parseRepo("ssh://git@git.example.com/team/app"), { url: "ssh://git@git.example.com/team/app", label: "git.example.com/team/app", name: "app", github: false });
  assert.deepEqual(parseRepo("git@gitlab.com:team/app.git"), { url: "git@gitlab.com:team/app.git", label: "gitlab.com:team/app", name: "app", github: false });
});
t("refused before it's sent: credentials, queries, other schemes, no path, spaces, bad owners", () => {
  for (const v of ["", "   ", "octocat", "octo cat/x", "-octocat/x", "octocat/..", "https://user@gitlab.com/a/b", "https://u:p@gitlab.com/a/b",
    "https://gitlab.com/a/b?ref=x", "https://gitlab.com/a/b#x", "https://gitlab.com/", "http://gitlab.com/a/b", "file:///etc/x", "ftp://h/a"])
    assert.equal(parseRepo(v), null, JSON.stringify(v));
});
t("slugify: the folder a name makes", () => {
  assert.equal(slugify("Billing API"), "billing-api");
  assert.equal(slugify("  Café — Ünïcode!  "), "cafe-unicode");
  assert.equal(slugify("---"), "");
  assert.equal(slugify("a".repeat(60)).length, 48);
});

console.log(`\n${passed} passed`);
