# Privacy disclosure draft

Contact CTA Inspector, maintained by Jigar Prajapati, processes the active page locally only when you choose Scan. It reads candidate link attributes and uses limited button labels locally to identify contact controls. It does not read input values, collect form submissions, inspect event-handler code or execute discovered URLs.

Version 1.1.0 also uses bounded accessible names, visible label text and explicitly labelled nearby contact context to distinguish contact findings from general observations. Labels are processed locally only; findings contain a static classification reason, never the source label. Form/editable values are excluded. Heuristics can misclassify intent and do not verify whether a handler works.

The developer receives no browsing data. There are no accounts, analytics, advertisements, telemetry, backend services or extension network requests. No scan results or browsing history are saved to persistent storage. Popup results disappear when the popup closes. An isolated page registry holds element references and an opaque token for highlighting for up to five minutes or until navigation; re-scanning replaces it.

URL query strings and fragments, URL authority credentials and JavaScript/data payloads are hidden from findings before they leave the page. Contact email addresses, phone numbers and URL path contents can remain visible. Reports are not anonymized. Review copied reports before sharing. Copy changes your clipboard only when you request it; your operating system or clipboard tools may retain that copy independently of the extension.

Scanning covers the top-level light DOM only, excludes frames and shadow roots, and uses documented work limits. Highlight adds a temporary overlay, scrolls the target into view, and removes the overlay after three seconds or a subsequent scroll/resize. Scanning itself does not modify site content.

Permissions are limited to activeTab and scripting. File URLs need an additional user-controlled Chrome setting. No host permissions or persistent page monitoring are requested.

For privacy questions, contact the maintainer through [GitHub](https://github.com/jigar48) or [LinkedIn](https://www.linkedin.com/in/buildaiwith-jigar-prajapati/). Request a private channel before sharing sensitive details. This disclosure must be hosted at a public URL before store submission. Updated 2026-10-18.
