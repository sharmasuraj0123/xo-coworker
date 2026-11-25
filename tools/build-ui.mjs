import { build } from "esbuild";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { atRule } from "postcss";
import { parseHTML } from "linkedom";
import { javascript, member, walk } from "./conformance/syntax.mjs";
import { finishPublicTree } from "./build/public.mjs";
import { cssSyntax } from "./conformance/css-syntax.mjs";
import { stylesheetImport } from "./conformance/css-publication.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const destination = resolve(process.argv[2] || join(root, "dist"));
mkdirSync(destination, { recursive: true });
const out = mkdtempSync(join(destination, ".building-"));
try {
  const published = await buildPublic();
  console.log(published);
} finally {
  rmSync(out, { recursive: true, force: true });
}

async function buildPublic() {
  mkdirSync(join(out, "css"), { recursive: true });
  const entryPoints = {
    boot: "boot.js", skeleton: "modules/home/skeleton.js", files: "modules/files/module.js",
    github: "modules/github/surface.js", decisions: "modules/decisions/surface.js",
    map: "modules/map/module.js", artifacts: "modules/artifacts/module.js", runs: "modules/runs/module.js",
  };
  await build({
    absWorkingDir: root, entryPoints, outdir: join(out, "js"), entryNames: "[name]", chunkNames: "[name]-[hash]",
    format: "esm", target: "es2022", platform: "browser", splitting: true, bundle: true, minify: true,
    plugins: [{ name: "runtime-assets", setup(builder) {
      builder.onResolve({ filter: /\/vendor\// }, args => ({
        path: "../" + relative(root, resolve(args.resolveDir, args.path)), external: true,
      }));
      builder.onLoad({ filter: /\.js$/ }, args => {
        const source = readFileSync(args.path, "utf8");
        if (!source.includes("import.meta.url")) return;
        const original = "../" + relative(root, args.path);
        const references = [];
        walk(javascript(source, args.path).tree, node => {
          if (node.object?.type === "MetaProperty" && node.object.meta.name === "import" && member(node) === "url") references.push(node);
        });
        let contents = source;
        for (const { start, end } of references.reverse()) {
          contents = contents.slice(0, start) + `new URL(${JSON.stringify(original)},import.meta.url).href` + contents.slice(end);
        }
        return { contents, loader: "js" };
      });
    } }],
  });

  function cssFile(file) {
    const tree = cssSyntax(readFileSync(file, "utf8"), file, () => {});
    tree.walkDecls(decl => {
      decl.value = decl.value.replace(/url\(\s*(['"]?)([^)'"]+)\1\s*\)/gi, (match, quote, ref) => {
        if (/^(?:\/|[a-z]+:|#)/i.test(ref)) return match;
        return `url("${relative(join(root, "css"), resolve(dirname(file), ref))}")`;
      });
    });
    tree.walkAtRules("import", rule => {
      const { target, layer, condition } = stylesheetImport(rule.params);
      let children = cssFile(resolve(dirname(file), target)).nodes;
      if (layer) children = [atRule({ name: "layer", params: layer[1] ?? "", nodes: children })];
      if (condition) children = [atRule({ name: "media", params: condition, nodes: children })];
      rule.replaceWith(...children);
    });
    return tree;
  }

  const { document } = parseHTML(readFileSync(join(root, "index.html"), "utf8"));
  const css = [];
  for (const link of document.querySelectorAll('link[rel~="stylesheet"]')) {
    const sheet = cssFile(join(root, link.getAttribute("href"))).toString();
    const media = link.getAttribute("media");
    css.push(media ? `@media ${media}{${sheet}}` : sheet);
    if (css.length === 1) { link.setAttribute("href", "./css/app.css"); link.removeAttribute("media"); }
    else link.remove();
  }
  for (const script of document.querySelectorAll('script[type="module"][src]')) {
    const entry = script.getAttribute("src").replace(/^\.\//, "");
    const match = Object.entries(entryPoints).find(([, file]) => file === entry);
    if (!match) throw new Error(`Missing build entry for ${entry}`);
    script.setAttribute("src", `./js/${match[0]}.js`);
  }
  writeFileSync(join(out, "css/app.css"), css.join("\n"));
  writeFileSync(join(out, "index.html"), document.toString());
  const version = finishPublicTree(root, out);
  const published = join(destination, version);
  try { renameSync(out, published); }
  catch (error) {
    if (!["EEXIST", "ENOTEMPTY"].includes(error.code) || !existsSync(join(published, ".build.json"))) throw error;
  }
  const pointer = out + ".current";
  try {
    writeFileSync(pointer, version + "\n");
    renameSync(pointer, join(destination, "current"));
  } finally { rmSync(pointer, { force: true }); }
  return published;
}
