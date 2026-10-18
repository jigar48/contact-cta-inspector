# Public GitHub publication preparation

Prepared target: `jigar48/contact-cta-inspector`. Description: **Privacy-first Chrome extension that separates contact CTA format findings from general link observations, with offline checks, actionable fixes and redacted reports.**

Topics: `chrome-extension`, `manifest-v3`, `typescript`, `developer-tools`, `quality-assurance`, `accessibility`, `whatsapp`, `mailto`, `privacy`, `offline`.

## Git review

The current branch is `main` with no commits. All project source is untracked, so normal tracked/staged diffs are empty. The review covers the prospective first-commit file set, not an unavailable historical diff. Origin is configured to the requested HTTPS GitHub repository. A read-only `git ls-remote --heads origin` succeeded with no branch heads returned at review time. No repository was created or modified remotely.

The intended public files are source, tests, build scripts, locked dependencies, docs/screenshots, synthetic demo, authored icon sources/PNGs, MIT LICENSE, SECURITY.md, CONTRIBUTING.md and the CI workflow. node_modules, dist, release ZIPs, coverage and logs are ignored. No form data, real customer fixtures, real scanned browsing contents, machine-specific personal paths or credentials are intentionally included. The source review script checks common secret formats and personal paths without printing matching contents. This is a bounded pattern review, not proof that every possible secret is absent.

No blocking public-source issue was identified in the reviewed file set. Maintainer attribution and public profile links are intentional. The repository is prepared for publication subject to the owner's final review and explicit authorization; current GitHub visibility and settings were not changed or audited.

## Commit plan — approval still required

Use one coherent initial commit, **`feat: release Contact CTA Inspector 1.1.0`**, containing the intentional file set above. Inspect staged names/diff and rerun source review before committing. Keep build outputs out of Git; use CI artifacts and an explicitly approved GitHub release asset for distribution. No commit or staging was performed during preparation.

After explicit authorization, commit and push `main` to the configured origin. Do not create another repository. Wait for all six Node 22/24 × Ubuntu/Windows/macOS CI jobs. Each clean-installs, typechecks, tests, lints, checks formatting, builds, verifies ZIP identity/version, reviews source patterns and runs dependency audit. Successful local checks are not evidence that remote CI ran. Branch protection and required checks should be configured by the owner after the workflow is available.

## Release plan — separate approval required

After CI passes, approve the final version, notes in RELEASE-NOTES.md and the ZIP checksum from package inspection. Only then tag/publish a GitHub release and attach `contact-cta-inspector-1.1.0.zip`. The store listing and privacy disclosure remain drafts. Chrome Web Store publication additionally needs hosted privacy text, publisher declarations, store-sized screenshots and explicit approval.

Browser acceptance currently runs locally using installed Chrome and an isolated temporary profile; it is not a required CI step because the experimental extension-testing protocol depends on the installed Chrome version. Run `npm run smoke` on the release workstation and retain docs/smoke-results.json. Manual screen-reader/native-popup zoom checks remain recommended before a broad store release.

## Reproduce locally

```sh
npm ci
npm run check
npm run package:check
npm run source:review
npm audit --audit-level=moderate
npm run smoke
npm run reproducibility
```

`npm run reproducibility` builds twice and asserts identical ZIP SHA-256 hashes in the same environment. The lockfile, sorted filesystem collection and fixed local ZIP timestamps stabilize inputs. Byte identity across different Node/Vite/browser versions has not been asserted. Generated icons are already checked in; normal builds do not regenerate them or depend on Chrome.

## Hire Me

**Jigar Prajapati** builds browser extensions, developer utilities and privacy-conscious web applications. [GitHub](https://github.com/jigar48) · [LinkedIn](https://www.linkedin.com/in/buildaiwith-jigar-prajapati/).
