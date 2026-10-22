import { expect, it } from "vitest";
import { jsonReport, MAX_JSON_LENGTH } from "../src/json-report";
import type { Finding, ScanResult } from "../src/types";

const finding: Finding = {
  id: 5,
  category: "email",
  severity: "error",
  intent: "destination",
  scope: "contact",
  count: 2,
  link: "mailto:bad?body=PRIVATE#SECRET",
  explanation: "Invalid recipient",
  fix: "Use a complete address.",
};
const scan = (findings: Finding[] = []): ScanResult => ({
  page: "https://user:PRIVATE@example.test/path?key=PRIVATE#SECRET",
  inspected: 12,
  truncated: false,
  frames: 2,
  token: "PRIVATE_TOKEN",
  findings,
});

it("exports a versioned empty report with origin only and no internal metadata", () => {
  expect(JSON.parse(jsonReport(scan()))).toEqual({
    schemaVersion: 1,
    pageOrigin: "https://example.test",
    inspected: 12,
    truncated: false,
    contactFindings: [],
    generalObservations: [],
  });
});
it("preserves categories, severities, counts, intent and explanations in separate sections", () => {
  const findings: Finding[] = [
    finding,
    { ...finding, category: "telephone", severity: "info", link: "tel:123" },
    {
      ...finding,
      category: "whatsapp",
      severity: "warning",
      link: "http://wa.me/123",
    },
    {
      ...finding,
      category: "placeholder",
      scope: "general",
      intent: "none",
      link: "#",
    },
  ];
  const result = JSON.parse(jsonReport({ ...scan(findings), truncated: true }));
  expect(result.truncated).toBe(true);
  expect(result.contactFindings).toHaveLength(3);
  expect(result.generalObservations).toHaveLength(1);
  expect(result.contactFindings[0]).toEqual({
    category: "email",
    severity: "error",
    intent: "destination",
    count: 2,
    destination: "mailto:bad[query/fragment hidden]",
    explanation: finding.explanation,
    suggestedFix: finding.fix,
  });
  expect(result.contactFindings.map((f: Finding) => f.severity)).toEqual([
    "error",
    "info",
    "warning",
  ]);
  expect(result.generalObservations[0].intent).toBe("none");
});
it.each([
  "https://user:PRIVATE@example.test/path?password=PRIVATE#SECRET",
  "mailto:bad?bcc=PRIVATE&body=PRIVATE#SECRET",
  "javascript:alert('PRIVATE')",
  "data:text/html,PRIVATE",
  "#SECRET",
  "java\nscript:PRIVATE",
  "//user:PRIVATE@example.test/path",
  "https:user:PRIVATE@example.test/path?password=PRIVATE",
  "https:\\user:PRIVATE@example.test/path",
])("redacts sensitive destination data: %s", (link) => {
  const output = jsonReport(scan([{ ...finding, link }]));
  expect(output).not.toContain("PRIVATE");
  expect(output).not.toContain("SECRET");
  expect(() => JSON.parse(output)).not.toThrow();
});
it("is deterministic, omits arbitrary keys and does not mutate scan data", () => {
  const input = scan([
    {
      ...finding,
      ...JSON.parse('{"__proto__":{"polluted":true},"label":"PRIVATE_LABEL"}'),
    },
  ]);
  const before = JSON.stringify(input);
  expect(jsonReport(input)).toBe(jsonReport(structuredClone(input)));
  expect(jsonReport(input)).not.toMatch(/__proto__|polluted|label|PRIVATE/);
  expect(JSON.stringify(input)).toBe(before);
});
it.each(["null", "file:///private/path?secret=PRIVATE"])(
  "hides opaque and file page paths: %s",
  (page) => {
    expect(JSON.parse(jsonReport({ ...scan(), page })).pageOrigin).toBe("null");
  },
);
it.each([
  { inspected: NaN },
  { inspected: -1 },
  { truncated: "false" },
  { page: "javascript:PRIVATE" },
  { findings: [null] },
  { findings: [{ ...finding, category: "__proto__" }] },
  { findings: [{ ...finding, count: Infinity }] },
  { findings: [{ ...finding, scope: "other" }] },
  { findings: [{ ...finding, severity: "other" }] },
  { findings: [{ ...finding, intent: "other" }] },
  { findings: [{ ...finding, link: {} }] },
  { findings: [{ ...finding, explanation: "x".repeat(4097) }] },
])("rejects malformed data safely: %j", (changes) => {
  expect(() => jsonReport({ ...scan(), ...changes } as ScanResult)).toThrow(
    /invalid or oversized/,
  );
});
it("exports the full normal scan budget and rejects oversized input without partial JSON", () => {
  const findings = Array.from({ length: 250 }, () => ({ ...finding }));
  const output = jsonReport(scan(findings));
  expect(output.length).toBeLessThan(MAX_JSON_LENGTH);
  expect(JSON.parse(output).contactFindings).toHaveLength(250);
  expect(() => jsonReport(scan([...findings, finding]))).toThrow();
  expect(() =>
    jsonReport(
      scan(
        findings.map((f) => ({
          ...f,
          explanation: "x".repeat(4096),
          fix: "x".repeat(4096),
        })),
      ),
    ),
  ).toThrow();
});
