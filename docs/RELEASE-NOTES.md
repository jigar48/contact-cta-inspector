# Contact CTA Inspector 1.2.0 release candidate

- Scan and Re-scan keep their keyboard focus during work, after completion and after a scan error. Filter changes report the number of results through the popup status.
- The text export’s accessible name includes “Copy both sections”. The findings landmark follows the selected view. Filter and fallback field boundaries and the findings focus outline are easier to see.
- The compact native popup lets the whole view scroll when Chrome gives it less vertical space, including at 200% default Page zoom.
- This candidate includes the existing conservative missing accessible-name warnings and Copy safe summary. The safe summary uses counts and fixed category descriptions. The detailed text and JSON exports can still include contact addresses and paths.

Extract `contact-cta-inspector-1.2.0.zip` and select the extracted folder in Chrome’s **Load unpacked** dialog. For a source checkout, run `npm ci` and `npm run build`, then load `dist`.

The candidate passed the automated checks against the real unpacked extension. Manual screen-reader acceptance is still open. See the [verification matrix and reproduction steps](VERIFICATION.md#v120-accessibility-acceptance).
