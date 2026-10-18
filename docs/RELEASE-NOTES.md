# Contact CTA Inspector 1.1.0 — release notes draft

Contact inspection now starts with customer contact findings, while ordinary navigation placeholders live in a separate general-observations view. A page with many menu placeholders no longer looks like it has many contact CTA failures.

- Direct WhatsApp, tel and mailto destinations remain contact signals; bounded, explainable contact labels and nearby contact-group context identify scripted/placeholder controls.
- General observations remain available for manual review. Neither placeholders nor JavaScript controls are automatically declared broken.
- Duplicate groups and affected-element totals are shown per view. Severity counts are groups in the selected view; category/severity filters affect displayed cards. Reports include both counted sections regardless of filters.
- The compact 416px popup, redacted reports, keyboard controls and temporary highlight remain intact.
- Credential redaction handles long and malformed multi-@ userinfo before clipping. No new permissions, dependencies, storage or network operations were added.

Install the prepared `contact-cta-inspector-1.1.0.zip` by extracting it and selecting the folder in Chrome's Load unpacked dialog. Source checkouts use `npm ci` then `npm run build`. Reload an existing unpacked installation after replacing its files.

Classification is heuristic and primarily English-language. Formats do not prove a working number, inbox, account or event handler. All frames and shadow roots remain excluded; work limits can truncate findings. Reports retain contact addresses and path content; review before sharing.

See VERIFICATION.md for executed checks and remaining unverified manual accessibility/native-popup zoom and cross-platform CI checks. This draft is prepared locally; no release has been published.

Maintainer: **Jigar Prajapati** · [GitHub](https://github.com/jigar48) · [LinkedIn](https://www.linkedin.com/in/buildaiwith-jigar-prajapati/).
