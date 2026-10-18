import { build } from "vite";
import { readFile, writeFile, mkdir, readdir, rm } from "node:fs/promises";
import { zipSync } from "fflate";
const { version } = JSON.parse(await readFile("package.json", "utf8"));
await build({
  configFile: false,
  build: {
    target: "es2022",
    emptyOutDir: false,
    minify: true,
    lib: {
      entry: "src/content.ts",
      name: "ContactCTAScanner",
      formats: ["iife"],
      fileName: () => "scanner.js",
    },
  },
});
await rm("dist/demo.html", { force: true });
await rm("dist/icons/icon.svg", { force: true });
// Return the scan result from the injected file, without exporting a page-accessible global.
const scanner = await readFile("dist/scanner.js", "utf8");
await writeFile(
  "dist/scanner.js",
  scanner.replace(/var ContactCTAScanner=/, "").replace(/;\s*$/, ";"),
);
const files = {};
async function collect(dir, prefix = "") {
  for (const entry of (await readdir(dir, { withFileTypes: true })).sort(
    (a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0),
  )) {
    const path = `${dir}/${entry.name}`,
      key = prefix + entry.name;
    if (entry.isDirectory()) await collect(path, key + "/");
    else
      files[key] = [
        new Uint8Array(await readFile(path)),
        { mtime: new Date(2020, 0, 1, 0, 0, 0) },
      ];
  }
}
await collect("dist");
await mkdir("release", { recursive: true });
await writeFile(
  `release/contact-cta-inspector-${version}.zip`,
  zipSync(files, { level: 9 }),
);
console.log("Packaged", Object.keys(files).join(", "));
