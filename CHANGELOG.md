# Changelog

## 1.2.0 — 2026-11-09 (prepared locally)

- Keep keyboard focus on Scan and Re-scan through loading, completion and errors. Announce filter counts in the existing status region.
- Match the text export button's accessible name to its visible label and name the findings region for the active view.
- Improve filter and clipboard fallback borders, keep the findings focus indicator visible, and let short or zoomed native popups scroll without squeezing the results.
- Include the existing accessible-name warnings and privacy-safe summary in the packaged release candidate.

## 1.1.0 — 2026-10-18 (prepared locally)

- Default contact-first findings with a separate general-observations view; ordinary navigation placeholders no longer inflate contact warning counts.
- Offline, bounded, explainable intent signals from destinations and contact labels/context. No domain-specific behavior or event-handler execution.
- Scope-aware duplicate grouping, contact-prioritized group limits and explicit group/element counts in UI and copied report sections.
- Preserved validation severities, filters, highlighting, privacy boundaries and compact popup; updated synthetic demos and screenshots.
- Hardened credential redaction for long and multiple-at-sign authorities; labels are not returned and editable/form values are excluded.
- Consistent 1.1.0 package/manifest versions, ZIP-to-dist identity checks and deterministic ZIP timestamps.
- Publication preparation only: no commit, push, remote creation or release publication.

## Popup redesign — 2026-10-18

- Explicit root sizing fixes Chrome popup intrinsic-width feedback; compact 416px layout replaces the hero.
- One-line header, 30px scan control, immediate inspected/severity counts and horizontal filters.
- Dedicated keyboard-scrollable findings, compact cards and persistent report/privacy controls.
- Initial, loading, clean, filtered-empty and error states; narrow-width and high-zoom fallbacks.
- Five additional popup tests and automated native Chrome dimension, scrolling, clipboard, keyboard and zoom checks. Validation rules, permissions and scanning semantics remain unchanged.

## 1.0.0 — 2026-10-18

- Initial on-demand MV3 extension with conservative WhatsApp, tel and mailto format checks.
- Placeholder review, bounded top-level extraction, duplicate grouping and severity/category filters.
- Query-redacted reports, temporary highlighting and accessible popup states.
- Synthetic automated tests, release packaging, CI matrix and store disclosure drafts.
