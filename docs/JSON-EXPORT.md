# Structured JSON export

After scanning, choose **Copy JSON** beside **Copy both sections**. Both actions
include all retained findings from both views, regardless of category, severity or
view filters. If clipboard access is denied or unavailable, an expanded, labelled,
read-only textarea receives keyboard focus with the full report selected. Copy it
using the browser's normal keyboard or context-menu commands.

## Version 1 contract

The UTF-8-compatible JSON text uses two-space indentation and fixed property order.
Identical scan data produces identical text; there is no timestamp or random ID.
Array order follows scan order within each section. Consumers should check
`schemaVersion` before interpreting a report. Breaking contract changes require a
new schema version; the extension's package version is independent.

| Field                 | Type                     | Meaning                                                     |
| --------------------- | ------------------------ | ----------------------------------------------------------- |
| `schemaVersion`       | integer, exactly `1`     | Export contract version                                     |
| `pageOrigin`          | string                   | HTTP(S) origin only; `"null"` for file/opaque origins       |
| `inspected`           | nonnegative safe integer | Candidate elements inspected, not all visited DOM nodes     |
| `truncated`           | boolean                  | Scanner reached a limit; retained results may be incomplete |
| `contactFindings`     | array of finding objects | Contact-related groups                                      |
| `generalObservations` | array of finding objects | General link observations                                   |

Each finding has exactly these fields:

| Field          | Type / values                                                      |
| -------------- | ------------------------------------------------------------------ |
| `category`     | `whatsapp`, `telephone`, `email`, `placeholder`, `accessible-name` |
| `severity`     | `error`, `warning`, `info`                                         |
| `intent`       | `destination`, `label-or-context`, `none`                          |
| `count`        | Positive safe integer: affected elements in this group             |
| `destination`  | Redacted string, up to 240 UTF-16 code units; can be empty         |
| `explanation`  | Static rule explanation string                                     |
| `suggestedFix` | Static rule guidance string                                        |

All fields are required. Empty sections are empty arrays. `truncated: false` does
not guarantee that every possible contact control was inspected or works.
Counts describe retained groups only. The existing scanner prioritizes contact
groups and caps results at 250 groups. Export rejects invalid data, fields longer
than 4,096 UTF-16 code units, more than 250 groups, or serialized output over
1,000,000 UTF-16 code units. It announces an error instead of copying partial or
invalid JSON. No export-only findings are silently dropped.

## Synthetic example

```json
{
  "schemaVersion": 1,
  "pageOrigin": "https://example.test",
  "inspected": 3,
  "truncated": false,
  "contactFindings": [
    {
      "category": "email",
      "severity": "error",
      "intent": "destination",
      "count": 2,
      "destination": "mailto:bad[query/fragment hidden]",
      "explanation": "At least one recipient has an invalid mailbox structure.",
      "suggestedFix": "Use complete local-part@domain recipients, separated by commas."
    }
  ],
  "generalObservations": []
}
```

## Privacy and QA use

The exporter uses an explicit field allowlist. It omits highlight IDs, scan tokens,
frame metadata and label text. Page paths, credentials, queries and fragments are
excluded from the origin. Destination redaction preserves the existing scanner's
privacy behavior: queries, fragments, URL credentials and JavaScript/data payloads
are hidden; a bare `#` marker is retained. Explanations and fixes come from static
rules, never collected labels. No telemetry, storage, network requests, permissions
or dependencies are added. Reports exist only in the popup and, on explicit copy,
the clipboard. A fallback is cleared on re-scan or a new copy attempt.

Contact addresses, telephone numbers and destination paths can remain visible.
Redaction is not a general secret detector: review reports before sharing,
especially paths containing application-specific private data. JSON strings are
data, not safe HTML; downstream tools must render them as text.

QA tools can parse the JSON, check the version and incomplete flag, compare group
counts across scans, and attach reviewed reports to bug tickets. Separate general
observations from contact severity triage. Findings indicate format checks or
manual-review opportunities; they do not prove a destination is broken, a number
exists, an inbox delivers or a scripted control works. Only the top-level light
DOM is inspected. Frames, shadow roots, later mutations and event-handler code
are excluded; intent heuristics can miss or misclassify controls. See the README
for extraction budgets, supported contexts and other inspection limitations.

### Additive category compatibility

`accessible-name` is an additive version 1 category, always a contact warning with
`intent: "destination"`. Fields and types are unchanged. Consumers must tolerate
unknown category strings; consumers with a closed enum must add this value before
reading new reports. This is an enum extension, so such consumers are not forward
compatible without that update. JSON and text include the same independent name
and URL findings. A name warning does not say that a destination is broken or that
the page fails WCAG. Groups count unnamed occurrences only; one element may count
in both a URL group and a name group. See README for bounds and conservative skips.
