import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const files = [
  ...new Set(
    execFileSync(
      "git",
      ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
      { encoding: "utf8" },
    )
      .split("\0")
      .filter(Boolean),
  ),
].sort();
const patterns = [
  ["private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  [
    "GitHub token",
    /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/,
  ],
  ["AWS access key", /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ["API key", /\bsk-(?:proj-)?[A-Za-z0-9_-]{40,}\b/],
  ["personal absolute path", /[A-Z]:[\\/](?:Users|work)[\\/]/i],
];
let checked = 0;
for (const path of files) {
  assert(
    !/(?:^|\/)(?:\.env(?:\..*)?|id_rsa|id_ed25519)$|\.(?:pem|p12|pfx|key)$/i.test(
      path,
    ),
    `Sensitive file candidate: ${path}`,
  );
  if (
    !/\.(?:ts|js|mjs|json|md|html|css|svg|ya?ml)$|(?:gitignore|prettierignore)$/.test(
      path,
    )
  )
    continue;
  const value = await readFile(path, "utf8");
  checked++;
  for (const [label, pattern] of patterns)
    assert(
      !pattern.test(value),
      `${label} candidate in ${path}; review without publishing the value`,
    );
}
console.log(
  `Reviewed ${files.length} prospective source/assets; scanned ${checked} text files. No configured secret or personal-path patterns found. Pattern scanning cannot prove absence of secrets.`,
);
