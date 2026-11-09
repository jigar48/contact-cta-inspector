# v1.2.0 accessibility acceptance

Run on 2026-11-09 with **Chrome 157.0.8103.38**, **Windows 11 Home Single Language (build 26300)**, Node 24.22.1 and npm 12.2.2. Chrome loaded the unpacked MV3 extension from a fresh extraction of the final ZIP. The automated tests used an isolated profile and synthetic pages. **Screen reader and version: none.** NVDA was absent from the running processes, installed-app records and standard install paths checked. No screen-reader speech was captured.

| Scenario                               | Expected                                                                                                                                                                               | Actual                                                                                                                                                                                                                                                                                                             | Result                               |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------ |
| Native keyboard activation and order   | Enter and Space activate Scan. Focus stays on Re-scan. Tab reaches filters, findings, Highlight, copy actions and privacy. Shift+Tab reverses direction.                               | CDP keyboard input confirmed Scan focus through completion, forward traversal through all ten Highlight buttons and three copy actions, Space on Scope & privacy, and reverse traversal to Copy JSON.                                                                                                              | PASS (automated)                     |
| Filter, clipboard and scan-error focus | Filter focus stays put. Copy success keeps button focus. Clipboard denial focuses selected report text. Scan errors keep Re-scan usable.                                               | Filter regression passed. Extension-tab tests used real clipboard writes for all formats and forced denial for JSON and safe summary. Enter on the unsupported context left focus on Re-scan with an error status.                                                                                                 | PASS (automated)                     |
| Names, roles and reading order         | Named native controls, a named findings landmark, severity text and readable remediation.                                                                                              | Chrome exposed the named buttons, three comboboxes, headings and findings region. Native captures showed named severity badges and the `Fix:` paragraph.                                                                                                                                                           | PASS (Chrome tree and visual review) |
| Screen-reader speech                   | Scan progress, completion, filter counts, errors and clipboard feedback are spoken at useful times without excessive repetition. Findings and remediation are readable in browse mode. | No manual screen-reader session. The status DOM regression verifies one live region and the updated filter count.                                                                                                                                                                                                  | NOT VERIFIED                         |
| Native popup at 100%                   | Compact title and controls, scrollable findings and reachable footer.                                                                                                                  | Automated viewport was 416 × 510 CSS px after scanning. Findings had 173 px of height. Report actions and footer were visible.                                                                                                                                                                                     | PASS (automated)                     |
| Native popup at 150% and 200%          | Findings and controls remain usable without horizontal content overflow. Vertical scroll and keyboard access work.                                                                     | Headed Chrome measured 416 × 400 at 150% and 392 × 300 at 200%. Findings had 220 px at both settings. Captures and keyboard traversal reached the last finding, all copy actions and Scope & privacy. The extracted-ZIP smoke run at 200% measured 400 × 255 with the same 220 px findings pane.                   | PASS (automated and capture review)  |
| Visual states and contrast             | Visible keyboard focus and recognizable controls, disabled scan and errors. Findings convey severity in text.                                                                          | Sampled active text pairs were 4.96:1 or higher. Filter/fallback field borders measured 3.51:1 against white, blue focus 5.28:1 against white, and error text 6.94:1 against its background. The pending scan was dimmed and repeat activation was blocked. Error, Warning and Info appeared as words on findings. | PASS (sampled)                       |
| Human toolbar and keyboard walkthrough | Open and dismiss the native popup and traverse both directions without a trap.                                                                                                         | Chrome automation exercised the native popup. The human walkthrough remains open.                                                                                                                                                                                                                                  | NOT VERIFIED                         |

**Browser zoom.** Set the profile-wide **Page zoom** in Chrome Appearance and reopen the native popup. Chromium initializes action popups from that setting. A tab's zoom controls apply to that tab. The separate 320 px and 200% extension-tab checks also passed. Popup dimensions vary with Chrome's available screen space. [Chromium popup zoom implementation](https://chromium.googlesource.com/chromium/src/+/refs/heads/lkgr-android-internal/chrome/browser/extensions/extension_view_host.cc)

### Reproduce the manual checks

1. Use a disposable Chrome profile. Extract the v1.2.0 ZIP, open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select the extracted folder. Pin Contact CTA Inspector. Record the versions from `chrome://version`, Windows `winver` and NVDA **Help → About**.
2. From the source checkout, run `npm run dev -- --host 127.0.0.1`. Open `http://127.0.0.1:5173/demo.html` or use the port Vite prints. Open the extension from the toolbar. Tab to **Scan page**, press Enter, and verify that focus stays on **Re-scan**. Repeat with Space. Tab and Shift+Tab through filters, findings, each Highlight button, all copy actions and Scope & privacy. Use arrow keys in the findings region and Escape to dismiss the popup.
3. Run NVDA and open **NVDA menu → Tools → Speech Viewer**. Repeat the scan, switch View, and filter to an empty result and back. Record the speech for scan and filter changes. In browse mode, navigate by heading and read a card's severity, explanation and Fix text. On `chrome://version`, open the popup and attempt a scan to verify the error is spoken and Re-scan remains focused.
4. On the demo, activate **Copy safe summary** and verify the confirmation and retained focus. To force denial locally, inspect the popup with DevTools and run `Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async () => { throw new Error("Test denial"); } } })` in the popup console. Return focus to the popup and activate Copy again. Confirm the failure is spoken and the named, read-only fallback text is focused and selected. Close and reopen the popup to restore the clipboard API.
5. In the test profile, open `chrome://settings/appearance`. Set **Page zoom** to 100%, 150% and 200% in turn. Reopen the native toolbar popup on the demo after each change. Repeat the scan and tab traversal. Check for clipped or overlapping text, horizontal scrolling and focus visibility. Scroll through findings and reach all copy and privacy controls. Record any Chrome size limits separately.

### Build and release checks

- `npm run check` passed typecheck, lint, formatting, build and **164 tests across six files**. [Chrome smoke results](smoke-results.json)
- Package inspection, source-pattern review, and both full and production-only npm audits passed. The registry reported zero vulnerabilities. The ZIP contains nine files and grants `activeTab` and `scripting`. The extension CSP blocks outgoing connections from extension pages.
- Two clean builds produced the same 19,691-byte ZIP. SHA-256 `13605a5bb590a9ca0ec4bd0e2e374b5c6bcf46d9cf9b0ac9a0aa7db39803f446`.
- Keep the ZIP as a local candidate pending manual screen-reader and keyboard sign-off. Cross-platform CI and store review remain open. This checklist covers selected scenarios and makes no WCAG conformance claim.

## Historical record — safe summary local verification

Verified on 2026-11-07 with Windows, Node v24.22.1, npm 12.2.1 and Chrome
157.0.8103.38. The sections below this update are historical records.

- `npm ci` installed the locked dependencies. npm reported that it blocked
  esbuild's postinstall script. The production build and smoke checks passed
  with that default policy.
- `npm run check` passed type checking, lint, formatting, build and all
  163 tests across six files (7 new and 156 existing). New tests cover empty
  and incomplete scans, category order, grouped occurrences, hostile strings,
  malformed counts, filter independence and clipboard success and fallback.
- `npm run smoke` passed against the locally built extension. Chrome opened
  the native action popup and ran the scanner. In the extension tab, explicit
  clicks wrote all three formats to the clipboard. Forced denial produced the
  selected safe summary in the existing fallback. The summary was identical
  with filters applied and cleared.
- Reviewed the diff and synthetic screenshots. The copy buttons fit in the
  [native popup](screenshots/popup-native-results.png), wrap at
  [320 CSS pixels](screenshots/popup-narrow.png) and are reachable by
  scrolling at [200% extension-tab zoom](screenshots/popup-zoom-200-copy.png).
  Native-popup zoom and manual assistive technology testing remain unverified.
- `npm run package:check` and `npm run source:review` passed. The local
  ZIP is 19,567 bytes with SHA-256
  `6206b8add6bb2a4a9881ac76dd5cc61f69def64f00afeeb563e3d7795b1ac6a2`.
- `npm audit --audit-level=moderate` exited 1. It reported 10 moderate
  entries from one `minimatch` advisory through the existing ESLint and
  TypeScript ESLint development dependency tree. `npm audit --omit=dev
--audit-level=moderate` reported zero vulnerabilities. The package manifest
  and lockfile are unchanged.

The formatter uses only numeric counts, fixed scope/category/severity
comparisons and the incomplete flag. It emits fixed category descriptions
without using page or destination fields, raw reasons or suggestions.
Clipboard writes require a click and reuse the existing manual fallback.
The detailed text and JSON formats are unchanged. Package inspection
confirmed only `activeTab` and `scripting`. The feature adds no collection,
storage, telemetry, network access or dependencies.

## Synthetic before and after

Serve `public/demo.html` on localhost, open it in Chrome and click **Scan
page**. Before, a shareable write-up required reviewing the detailed
output by hand. On this fixture, **Copy both sections** includes the
synthetic destination `mailto:missing-at[query/fragment hidden]`, as does
**Copy JSON**. After, **Copy safe summary** includes the email category and
its counts without the destination. The repeated general placeholder
contributes two occurrences to one group, so three general groups account
for four occurrences.

The following is the actual output captured after Chrome successfully
wrote the summary to the clipboard. The General view, Email category and
Errors severity were selected, with zero cards visible. The
[smoke results](smoke-results.json) record the same text.

```text
Contact CTA Inspector — safe summary

Elements inspected — 19.

Contact-related findings
Finding groups — 10. Occurrences — 10.
Groups by severity — error 4, warning 3, info 3.
- WhatsApp link format or setup — groups 1, occurrences 1.
- Telephone link format or dialing context — groups 2, occurrences 2.
- Email link format or recipient setup — groups 3, occurrences 3.
- Missing, placeholder or scripted link destinations — groups 3, occurrences 3.
- Contact controls that may lack an accessible name — groups 1, occurrences 1.

General link-quality observations
Finding groups — 3. Occurrences — 4.
Groups by severity — error 0, warning 3, info 0.
- Missing, placeholder or scripted link destinations — groups 3, occurrences 4.

Occurrences are summed per finding group. One element can contribute to multiple groups.

Findings are heuristic. They do not prove that a CTA is broken or establish WCAG compliance.
```

Aggregate counts and categories can still reveal limited information about a
page. Review the summary before sharing. If scan limits are reached, counts
describe only the findings retained by the scan.

---

# Final integration review — 2026-10-27

Initial HEAD matched approved commit `7762b6d916c1726229040288baf8039af5662cb8`
and the working tree was clean. Fetched remote main was its direct parent.
Final review found a conservative naming correction: nested `aria-labelledby`
references now defer instead of approximating chained IDREF recursion and risking
a false unnamed warning. A regression covers meaningful text on a referenced
node that itself has an empty naming reference. URL validation is unchanged.

Revalidated with `npm ci`, `npm run check` (156 tests: 28 new, 128 existing),
`npm run smoke`, `npm run package:check`, `npm run source:review` and
`npm audit --audit-level=moderate` (zero vulnerabilities). Before/after demo,
text/JSON export, filters and highlighting pass in Chrome 156.0.8078.47.
Permissions, privacy/redaction, schemaVersion 1 fields, deterministic grouping
and finding limits remain unchanged. Closed-category-enum consumers still need
to accept `accessible-name`. Manual assistive-technology evaluation is excluded.

Corrected local ZIP: 19,036 bytes; SHA-256
`99f2760c69701bcc72eceff408638bbd374bf9e62237b419ab19c6e179253841`.
Hosted CI verification is reported separately in the integration result.

---

# Accessible-name warnings — local verification

Date: 2026-10-27. Windows, Node v24.22.1, npm 12.2.1 (temporary shim outside
this repository), Chrome 156.0.8078.47. The sections below this update describe
historical verification and publication state.

- `npm ci`: pass; 175 packages, lockfile unchanged.
- `npm run check`: pass; 155 tests in five files (27 new, 128 existing), strict
  types, lint, formatting, build and ZIP packaging.
- `npm run smoke`: pass; synthetic demo has 19 candidates, 10 contact groups and
  three general groups. The new name group contains only the unnamed WhatsApp
  occurrence. Chrome also verifies SVG title, hidden ARIA reference, visually
  hidden text and conservative CSS-generated-content deferral. Existing native
  popup, highlighting, filtering, text/JSON clipboard, fallback, narrow layout
  and extension-tab zoom checks pass. Refreshed screenshots/results are included.
- `npm run package:check`, `npm run source:review`: pass.
- `npm audit --audit-level=moderate`: pass, zero vulnerabilities.

Local ZIP: 19,035 bytes; SHA-256
`221ad79937b995c0717a670dfa460491458999ac47138241ec412cb71f498ef5`.

Complete source/test/documentation diff reviewed. No dependencies or Chrome
permissions added; only activeTab and scripting remain. No runtime network,
telemetry, event-handler inspection/execution, page HTML injection, page-text or
form-value export was introduced. Naming text stays local, URL redaction remains
in force, and highlight references are still bounded by 250 retained groups.
Contact URL validation runs first; missing-name warnings cannot replace contact
URL results within the existing budget. General observations remain separate.

JSON remains schemaVersion 1 with the documented additive `accessible-name`
category. Closed-enum consumers need an update. Text and JSON exports contain the
same findings. Occurrence totals sum per group and can include the same control
in both a URL group and a name group.

GO for local use and review. This is a conservative missing-name heuristic, not a
complete accessibility audit or WCAG assessment. Unsupported/ambiguous naming,
deeply nested controls, frames and shadow roots can be skipped. Manual assistive
technology evaluation and other OS/Node combinations remain unverified. One
local commit is requested; no push, release, publication, tag or deployment.

---

# Structured JSON export — local verification

Date: 2026-10-22. Windows, Node v24.19.0, npm 11.17.0, Chrome
155.0.8059.85. npm used a temporary tool shim outside the repository because only
Node was initially on PATH; no machine-wide installation was changed.

- `npm ci`: pass, lockfile unchanged, 175 packages installed; zero known vulnerabilities.
- `npm run check`: pass (strict typecheck, 128 tests in four files, lint,
  formatting, production build and ZIP packaging). All 95 existing tests remain;
  33 regression cases were added.
- `npm run package:check`, `npm run source:review`,
  `npm audit --audit-level=moderate`, `npm run reproducibility`: pass.
- `npm run smoke`: pass using the packaged extension in real installed Chrome.
  Native action popup, scan/filter/highlight, real text/JSON clipboard writes,
  forced-denial JSON fallback, selected textarea focus, 320px layout and 200%
  extension-tab zoom are covered. JSON includes all nine contact and three general
  groups while a category filter is active. Both copy actions remain reachable.
  Machine-readable results and refreshed synthetic screenshots accompany this file.

Artifact: `release/contact-cta-inspector-1.1.0.zip`, 18,029 bytes, SHA-256
`9cd21931ee3bffed0a6dac2a2568da5218deb50206f223600cee041143f662af`.
Version metadata, runtime dependencies and manifest permissions are unchanged.

## Change review

The exporter builds an explicit, fixed-order allowlist of JSON fields, excludes
labels and internal highlight metadata, normalizes page origins, re-redacts
bounded destinations and rejects invalid enums, counts and field sizes. Arrays
retain scanner order. Empty sections serialize as arrays. No dynamic HTML or
object merging from scan data is introduced; arbitrary keys including
`__proto__` are not copied. Reports over the output budget fail visibly rather
than being clipped or silently dropping groups. Work and memory are bounded by
250 groups, 4,096 code units per input string and a final serialized-size check.
The source scanner's normal reports fit comfortably within the output limit.

Two verified issues were corrected: browser-normalized credential URLs without
ordinary double slashes could retain credentials, and delayed clipboard callbacks
could restore stale fallback data after re-scan. Credential hardening applies
before findings leave the page and preserves the existing standard-URL output.
Regression cases exercise both scanner integration and export. Copy attempts now
invalidate earlier callbacks. Clipboard absence/rejection uses text-only rendering,
an expanded labelled read-only textarea, focus and selection. Re-scan and a new
copy attempt clear the fallback.

No unresolved blocking security or correctness issue was found. No added runtime
network access, telemetry, permissions, storage or dependencies. Common-pattern
source scanning and dependency auditing cannot prove absence of all vulnerabilities.
Review retained contact identifiers and paths before sharing. Findings do not
prove a destination is broken or delivery works.

Manual screen-reader use, human toolbar interaction, native-popup zoom and browser
store review remain unverified. CI platform results must be checked in the hosted
run; local Chrome evidence alone does not establish them. See
[JSON export](JSON-EXPORT.md) for the contract and limitations.

---

The following is the historical 2026-10-18 verification record. Its package hash,
test counts and pre-publication statements describe that earlier snapshot only.

# Contact CTA Inspector 1.1.0 — local verification

Date: 2026-10-18. Environment: Windows, Node v24.19.0, npm 11.6.2, installed Chrome 155.0.8059.82. npm was invoked through a temporary local tool shim because the host initially supplied Node without npm on PATH; no machine-wide installation was changed.

| Executed check                     | Result                                                                                               |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `npm ci`                           | Pass; 175 packages installed, 176 audited                                                            |
| `npm run typecheck`                | Pass; strict TypeScript                                                                              |
| `npm test`                         | Pass; 95 tests in 3 files                                                                            |
| `npm run lint`                     | Pass; no warnings/errors                                                                             |
| `npm run format:check`             | Pass                                                                                                 |
| `npm run build`                    | Pass; current popup, self-contained scanner and icons                                                |
| `npm run package:check`            | Pass; nine required runtime files; every ZIP byte matches dist; package/lock/manifest versions agree |
| `npm audit --audit-level=moderate` | Pass; zero known vulnerabilities                                                                     |
| `npm run source:review`            | Pass; common secret and personal-path patterns not found; see limitation below                       |
| `npm run reproducibility`          | Pass; two consecutive builds produce identical ZIP SHA-256                                           |
| `npm run smoke`                    | Pass in real installed Chrome; machine-readable details in smoke-results.json                        |

## Product acceptance

Release artifact: `release/contact-cta-inspector-1.1.0.zip`, **17,329 bytes**. SHA-256: `3b027257080b4c4b19614137a251a576fb87d68baca906fb6eec36f26a0bb58b`. The ZIP contains the current build; dependency audit reports zero known vulnerabilities.

Changed implementation areas: new `src/intent.ts`; scoped extraction, normalization/types, reporting and popup in `src/extract.ts`, `scan.ts`, `types.ts`, `report.ts`, `popup.ts`, `style.css`; credential hardening in `privacy.ts`. Validator rules and highlight/messaging code are unchanged. Tests add `tests/intent.test.ts` and extend `popup.test.ts`. Build/release changes cover version metadata, packaging/inspection, browser discovery/acceptance, reproducibility/source review, CI and the synthetic demo. Documentation, screenshots and release drafts are updated. Source publication files remain unstaged.

The default view now contains contact findings only. Direct mailto/tel/recognized WhatsApp destinations have a destination reason. Placeholders/scripted controls can have a bounded contact label/context reason; all other validator findings are separate general observations. Severity rules remain unchanged. General placeholders receive neutral navigation/script-behavior fix text. Neither section claims placeholders or JavaScript controls are confirmed broken.

Duplicate grouping is scoped: the same `#` can produce one contact group and one general group with distinct affected-element totals. Severity counters count groups across the selected view; category/severity filters affect cards. View options give section group/occurrence totals, and the findings header gives filtered groups/occurrences. Reports include both counted sections, explicit uncertainty and a classification reason. Contact groups receive the report budget before general groups within extracted candidates; retained counts are incomplete if limits are hit.

The user's 367-element scenario is reproduced synthetically: 79 ordinary navigation placeholders, two identical menu JavaScript links, one missing href and 285 regular links. Result: **0 contact groups; 3 general groups representing 82 elements** (two warning groups and one info group). Chrome automation verifies zero contact warnings, discoverability of general observations and the 82-element total. No domain is hardcoded. The live customer site was not visited or retested in this session.

## Automated coverage

The original 61 tests are retained and updated for the new data contract and UI wording. Additional tests cover contact destinations, ordinary navigation labels and false-positive examples, contact-labelled placeholders, JavaScript contact controls, accessible-name precedence, nested/ARIA/image labels, bounded group context, editable/form exclusion, scoped duplicates, group/occurrence counts, prioritization at the report limit, contact-first filters/rescan defaults, general-only scans and sectioned reports. Redaction tests include query tokens, body text, malformed multi-@ credentials and long userinfo before clipping. Existing WhatsApp/tel/mailto, URI encoding, SVG, dynamic/empty/large DOM, unsupported-page, clipboard, highlight cleanup and messaging-failure cases remain passing. Fixtures are synthetic.

## Real Chrome acceptance

Automation loads unpacked through DevTools Protocol, triggers the extension action to grant activeTab, attaches to the native action popup and invokes its actual Scan control. It also uses a second extension-document tab for clipboard, highlight, keyboard, narrow-width and zoom checks. These use packaged code and a temporary isolated profile; no user profile is touched. Human toolbar clicking is not claimed.

- Native initial viewport: **416 × 220px**. Native scanned viewport: **416 × 510px**, showing 9 contact groups from the 17-element demo. The same scan retains 3 general groups representing 4 elements separately.
- One-line heading: 20px high; Scan/Re-scan button: 30px high. Findings begin at y=244.3125px with a 191.1875px independent viewport. Report/privacy footer ends at y=510px and remains visible. Nominal app height limit is 580px; settled Chrome viewport clipping can reduce it.
- Contact/general switching, empty-filter recovery, category/severity filters, native findings scrolling, actual clipboard write, and real highlight injection/cleanup pass. Fixture content is unchanged after highlight cleanup.
- Keyboard Tab order: Scan → View → Category → Severity → findings; ArrowDown scrolls the focused findings region. Native controls and visible focus styles remain.
- A 320px extension-document viewport with a synthetic long URL has no overflowing card/control text. Chrome `tabs.setZoom(2)` produces 208 CSS pixels in a 416px tab viewport, without horizontal content overflow. Whole-popup scrolling keeps Copy both sections reachable. **This is tab zoom, not a native-popup zoom test.**

Native width fixes remain intact: explicit 416px root sizing, body filling the root with narrow-viewport adaptation, global border-box, zero flex/grid minimums and minmax filter columns. Viewport-height caps are deferred until Chrome's initial intrinsic measurement settles; subpixel rounding is tolerated to avoid trapping a restored filter view at a smaller height.

Screenshots in screenshots/ were captured from the current build and reviewed: popup-native-initial/results/general, popup-empty/results/error/no-findings, popup-navigation-noise, popup-narrow and popup-zoom-200. Native shots come directly from the action popup. Other shots use its extension document in a tab. All content is synthetic; images are not store-sized marketing assets.

## Security and privacy review

Manifest review confirms only activeTab and scripting; no host permissions, background worker, static content scripts or storage. Runtime code performs no analytics, remote API requests, history persistence, URL navigation, clicks, submissions, eval or handler execution. The ZIP inspection rejects unexpected files and network/dynamic-code patterns. Vite's unused network-based preload helper remains disabled. No runtime dependencies are shipped.

Page-derived values render via textContent, not dynamic HTML insertion. Only static application markup uses innerHTML. Bounded label text never leaves the page; findings expose static intent reasons. Form values/editable text are excluded. Queries, nonempty fragments, script/data payloads and full authority userinfo are removed before findings leave the page; the harmless empty `#` marker remains visible. Credential removal precedes clipping, including malformed multi-@ and long inputs. Contact identifiers and arbitrary path content remain: reports are redacted, not anonymized, and must be reviewed before sharing.

Scanning does not change DOM content. Highlighting temporarily adds a pointer-transparent overlay and scrolls the target into view, then cleans up on timeout/scroll/resize; target styles are unchanged. Registry element references expire in five minutes or navigation. Chrome smoke verifies cleanup and unchanged fixture content.

Source review covers the entire prospective first-commit file set because main has no commits and all files are untracked. No configured common secret/personal-path pattern was found; synthetic test strings are intentional. PNGs were visually reviewed and contain synthetic data. Pattern scanning/auditing cannot prove the absence of every secret or unknown vulnerability. No blocking public-source issue was identified in the reviewed set. MIT attribution, SECURITY.md, CONTRIBUTING.md and read-only CI permissions were reviewed. No new dependencies or permissions were added.

## Release boundaries

Version 1.1.0 is prepared for local installation and owner review. CI defines six Node 22/24 × Ubuntu/Windows/macOS checks and source/ZIP/audit validation, but remote CI has not run. Reproducibility is asserted for two local builds with the same toolchain, lockfile, sorted packaging and fixed timestamps, not all possible toolchains.

Manual screen-reader evaluation, human native-toolbar interaction, native-popup 200% zoom, other operating systems/Node 22, live customer-site compatibility and store review remain unverified. Intent is heuristic and primarily English; complex/custom/non-English controls can be missed or misclassified. No real number, inbox, account, delivery or JavaScript handler is verified. Frames/shadow roots and content beyond limits remain excluded.

No files were staged, no commit/tag was made, no push/release/store publication/deployment occurred and no remote resources were created. A read-only origin-head check succeeded and returned no branch heads. Publication and commit/CI plans are in PUBLICATION.md. Store submission still requires a hosted privacy policy, store-sized images, publisher declarations and approval.
