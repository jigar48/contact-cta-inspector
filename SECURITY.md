# Security and privacy

Please do not publish reports containing real customer URLs, contact details or credentials. For a sensitive issue, contact Jigar Prajapati through the profile links in README and request a private reporting channel before sharing details. Do not send secrets in public issues.

The extension runs only local packaged code. DOM attributes are untrusted; findings render as text. All query and fragment content is omitted, rather than relying on a list of sensitive parameter names. JavaScript/data payloads and authority credentials are hidden. No remote scripts, eval, network operations, host permissions, persistent storage or form extraction are used. The manifest blocks connections from extension pages. Contact identifiers and path segments are not anonymized.

Scan results live in popup memory. The isolated-world registry retains only opaque IDs mapped to elements and an expiring token for highlighting; references are cleared after five minutes or navigation. Highlighting adds a pointer-transparent overlay, removes it after three seconds/on scroll/resize, and never edits target styles. Scanning does not mutate page content. The site can still change its own DOM while scanning.

Development tools are not shipped. Pinning uses package-lock.json and clean CI installs. Run npm audit before each release; an audit reflects known advisories only. Review ZIP contents, manifest permissions and generated code. Supported security updates currently target 1.x. See docs/VERIFICATION.md for checks and caveats.

Intent classification uses bounded local accessible labels and explicitly named nearby groups. Only static reason codes are returned, not label text. Form values and editable text are excluded from label traversal. No AI, network classification, event-handler inspection or domain-specific exceptions are used. Contact/general classification changes presentation, not validation severity. Credential redaction runs before display clipping and removes the full authority userinfo through the final @, including malformed multi-@ inputs. Redacted reports are not anonymized: contact identifiers and arbitrary path content remain.
