import { readFile, readdir } from "node:fs/promises";
import { unzipSync } from "fflate";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { TextDecoder } from "node:util";
const pkg = JSON.parse(await readFile("package.json", "utf8"));
const lock = JSON.parse(await readFile("package-lock.json", "utf8"));
const data = await readFile(`release/contact-cta-inspector-${pkg.version}.zip`);
const files = unzipSync(data);
const manifest = JSON.parse(new TextDecoder().decode(files["manifest.json"]));
assert.deepEqual(manifest.permissions, ["activeTab", "scripting"]);
assert(
  !manifest.host_permissions &&
    !manifest.background &&
    !manifest.content_scripts,
);
assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.version, pkg.version);
assert.equal(lock.version, pkg.version);
assert.equal(lock.packages[""].version, pkg.version);
for (const name of Object.keys(files))
  assert(
    /^(?:manifest\.json|index\.html|scanner\.js|assets\/index-[\w-]+\.(?:js|css)|icons\/icon(?:16|32|48|128)\.png)$/.test(
      name,
    ),
    `Unexpected packaged file: ${name}`,
  );
for (const name of Object.values(manifest.icons))
  assert(files[name], `Missing icon ${name}`);
for (const [name, bytes] of Object.entries(files)) {
  assert.deepEqual(
    Buffer.from(bytes),
    await readFile(`dist/${name}`),
    `ZIP differs from dist: ${name}`,
  );
  if (!name.endsWith(".js")) continue;
  const code = new TextDecoder().decode(bytes);
  assert(
    !/\beval\s*\(|new Function\s*\(|\bfetch\s*\(|XMLHttpRequest|https?:\/\/[^"'` ]+\.js/.test(
      code,
    ),
    `Unexpected runtime code in ${name}`,
  );
}
assert.equal((await readdir("dist/assets")).length, 2);
console.log(
  JSON.stringify(
    {
      files: Object.keys(files),
      bytes: data.length,
      sha256: createHash("sha256").update(data).digest("hex"),
      permissions: manifest.permissions,
    },
    null,
    2,
  ),
);
