# Contributing

Use Node 22.12+ or 24. Run `npm ci`, then `npm run check` and `npm audit --audit-level=moderate`. Add synthetic regression cases for rule changes. Keep dependencies small, permissions minimal and every scan explicitly initiated. Do not introduce telemetry, remote code, automatic URL navigation or page-data persistence.

Explain false positives and uncertainty; never claim contact delivery verification. Keep page-derived content out of HTML insertion and redact queries before transferring findings. Document new scan boundaries. Use public issues for reproducible, non-sensitive bugs; see SECURITY.md for sensitive reports. Pull requests should state behavior changes, tests run and limitations.

Intent rules belong in intent.ts, separate from format validators. Test ordinary navigation false positives, scope-aware grouping and occurrence counts whenever changing contact signals. Keep labels local, bounded and out of findings. Run `npm run package:check`, `npm run source:review` and `npm run reproducibility` before release; use `npm run smoke` with local Chrome for acceptance. Update package.json, package-lock.json and public/manifest.json versions together. No remote publication or release is automatic.
