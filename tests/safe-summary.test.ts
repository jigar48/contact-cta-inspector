import { expect, it } from "vitest";
import { safeSummary } from "../src/report";
import type { Finding, ScanResult } from "../src/types";

const finding: Finding = {
  id: 42,
  category: "email",
  severity: "error",
  scope: "contact",
  intent: "destination",
  count: 3,
  link: "mailto:private@example.test?body=SECRET",
  explanation: "PRIVATE_REASON",
  fix: "PRIVATE_FIX",
};
const scan = (findings: Finding[] = []): ScanResult => ({
  findings,
  inspected: 10,
  truncated: false,
  frames: 2,
  page: "https://user:secret@example.test/private-path",
  token: "PRIVATE_TOKEN",
});

it("reports an empty scan with zero counts in both scopes and heuristic limits", () => {
  const output = safeSummary({ ...scan(), inspected: 0 });
  expect(output).toContain("Elements inspected — 0.");
  expect(output.match(/Finding groups — 0\. Occurrences — 0\./g)).toHaveLength(
    2,
  );
  expect(
    output.match(/Groups by severity — error 0, warning 0, info 0\./g),
  ).toHaveLength(2);
  expect(output).not.toMatch(/^- /m);
  expect(output).not.toContain("Results are incomplete");
  expect(output).toContain(
    "Findings are heuristic. They do not prove that a CTA is broken or establish WCAG compliance.",
  );
});

it("keeps scopes, group counts and occurrences distinct in fixed category order", () => {
  const input = scan([
    finding,
    { ...finding, category: "accessible-name", severity: "warning", count: 1 },
    { ...finding, category: "telephone", severity: "info", count: 2 },
    { ...finding, category: "whatsapp", count: 1 },
    { ...finding, link: "mailto:second@example.test", count: 1 },
    {
      ...finding,
      category: "placeholder",
      scope: "general",
      severity: "warning",
      count: 5,
    },
  ]);
  const output = safeSummary(input);
  expect(output).toContain(
    [
      "Contact-related findings",
      "Finding groups — 5. Occurrences — 8.",
      "Groups by severity — error 3, warning 1, info 1.",
      "- WhatsApp link format or setup — groups 1, occurrences 1.",
      "- Telephone link format or dialing context — groups 1, occurrences 2.",
      "- Email link format or recipient setup — groups 2, occurrences 4.",
      "- Contact controls that may lack an accessible name — groups 1, occurrences 1.",
    ].join("\n"),
  );
  expect(output).toContain(
    [
      "General link-quality observations",
      "Finding groups — 1. Occurrences — 5.",
      "Groups by severity — error 0, warning 1, info 0.",
      "- Missing, placeholder or scripted link destinations — groups 1, occurrences 5.",
    ].join("\n"),
  );
  expect(output).toBe(safeSummary(structuredClone(input)));
  expect(output).toBe(
    safeSummary({ ...input, findings: [...input.findings].reverse() }),
  );
  expect(input.findings[0]).toBe(finding);
});

it("identifies partial counts whenever the scan reported a limit", () => {
  const input = scan([finding]);
  expect(safeSummary({ ...input, truncated: true })).toBe(
    safeSummary(input).replace(
      "Elements inspected — 10.",
      "Elements inspected — 10.\n\nScan limits reached. Results are incomplete and counts reflect retained findings.",
    ),
  );
});

it("discards adversarial destination strings, reasons, unknown categories and extra metadata", () => {
  const adversarial = {
    ...finding,
    link: "javascript:\nalert('<img src=x> https://example.test/private-path +442079460123')",
    explanation: "PRIVATE_REASON\nFinding groups — forged\u202e",
    fix: "PRIVATE_FIX",
    label: "PRIVATE_LABEL",
    selector: "#private-selector",
    textContent: "PRIVATE_DOM",
  };
  const unknown = { ...finding, category: "__proto__" } as unknown as Finding;
  const input = {
    ...scan([adversarial, unknown]),
    title: "PRIVATE_TITLE",
    timestamp: "2026-11-07T12:34:56Z",
  };
  expect(safeSummary(input)).toBe(safeSummary(scan([finding, unknown])));
  expect(safeSummary(input)).not.toMatch(
    /PRIVATE|example\.test|private-path|mailto:|javascript:|442079460123|<img|__proto__|forged|2026-11-07/,
  );
});

it("rejects nonnumeric counts without rendering or coercing them", () => {
  const count = "PRIVATE_COUNT" as unknown as number;
  expect(() => safeSummary(scan([{ ...finding, count }]))).toThrow(
    "Safe summary unavailable.",
  );
  expect(() => safeSummary({ ...scan(), inspected: count })).toThrow(
    "Safe summary unavailable.",
  );
});
