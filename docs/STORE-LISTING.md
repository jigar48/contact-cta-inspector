# Chrome Web Store draft

Name: Contact CTA Inspector

Short description: Inspect contact links on demand. Find invalid formats and suspicious placeholders without sending page data anywhere.

Description: Review WhatsApp, telephone and email link formats directly on the page you choose. Spot malformed recipients, invalid phone URL structure and contact placeholders. See actionable explanations, filter findings, briefly highlight an element and copy a redacted report. Built for developers, ecommerce agencies, website owners and QA testers by Jigar Prajapati.

Contact findings appear first. Ordinary navigation placeholders and other non-contact link observations stay in a separate opt-in view. Destination and bounded label/context heuristics explain intent; they can miss or misclassify a control. Severity counts represent grouped findings in the selected view, with affected-element totals shown separately. Copied reports include both sections. Scripted and placeholder controls require manual testing and are not confirmed broken.

Checks are conservative format checks, not real-number verification or delivery testing. Scripted CTAs need manual review. Only the top-level light DOM is scanned; all frames and shadow roots are excluded. No background scans, accounts, analytics or data upload. Queries, fragments and authority credentials are hidden in displayed/copied findings. Contact details and path segments can remain visible. Review reports before sharing.

Single purpose: Help users inspect customer contact CTA URL formats on the active page.

Permissions justification: activeTab provides temporary access to the page the user invokes the extension on. scripting runs packaged local extraction only after Scan and a brief overlay only after Highlight. No host permissions or background access are requested.

Privacy disclosure draft: No user data is transmitted to the developer or third parties, sold, used for advertising or stored as browsing history. Link attributes are processed locally when the user requests a scan. Results remain in popup memory until closed; temporary element references expire within five minutes. Copy writes a redacted report to the user's clipboard only at their request. No credentials, form values or event-handler code are collected. The extension does not fetch or visit discovered destinations.

Before submission: provide store-sized screenshots based on the included local screenshots, a publicly hosted privacy policy matching these statements and the publisher's completed data-use declarations. PNG icons are included in public/icons. Confirm current store policy and review guidance. This file is a draft, not a submitted listing.

Repository description: Privacy-first Chrome extension for on-demand inspection of WhatsApp, tel and mailto contact links, with actionable format checks and redacted reports.

Suggested topics: chrome-extension, manifest-v3, typescript, accessibility, quality-assurance, whatsapp, mailto, privacy, developer-tools
