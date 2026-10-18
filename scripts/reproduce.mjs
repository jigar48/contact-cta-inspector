import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const run = promisify(execFile);
const { version } = JSON.parse(await readFile("package.json", "utf8"));
async function build() {
  await run(process.execPath, ["node_modules/vite/bin/vite.js", "build"]);
  await run(process.execPath, ["scripts/package.mjs"]);
  return createHash("sha256")
    .update(await readFile(`release/contact-cta-inspector-${version}.zip`))
    .digest("hex");
}
const first = await build(),
  second = await build();
assert.equal(
  first,
  second,
  "Consecutive clean builds must produce identical ZIPs",
);
console.log(`Two builds match: SHA256 ${second}`);
