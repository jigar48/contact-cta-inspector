// @vitest-environment jsdom
import { beforeEach, expect, it } from "vitest";
import { inspect } from "../src/scan";
import { filterFindings, report, summarize } from "../src/report";
import { jsonReport } from "../src/json-report";
beforeEach(() => document.body.replaceChildren());
const scan = (markup: string) => {
  document.body.innerHTML = markup;
  return inspect(document, "test");
};
it("defers a text node truncated before its meaningful content", () => {
  expect(
    scan(
      '<a href="mailto:hello@example.test">' + " ".repeat(170) + "Email us</a>",
    ).result.findings,
  ).toEqual([]);
});
it.each([
  "https://wa.me/919876543210",
  "tel:+919876543210",
  "mailto:hello@example.test",
])("warns separately for an unnamed valid destination %s", (href) => {
  const { result, elements } = scan(
    `<a href="${href}"><svg aria-hidden="true"><path d="M0 0"/></svg></a>`,
  );
  expect(result.findings).toHaveLength(1);
  expect(result.findings[0]).toMatchObject({
    category: "accessible-name",
    severity: "warning",
    scope: "contact",
    intent: "destination",
  });
  expect(elements.get(0)).toBe(document.querySelector("a"));
});
it.each(['aria-label="Call us"', 'aria-labelledby="label"', 'title="Call us"'])(
  "accepts meaningful naming attribute %s",
  (attr) => {
    expect(
      scan(
        `<span id="label">Call us</span><a href="tel:+919876543210" ${attr}></a>`,
      ).result.findings,
    ).toEqual([]);
  },
);
it.each([
  '<img alt="Email us">',
  "<svg><title>Email us</title><path/></svg>",
  '<span style="position:absolute;clip:rect(0,0,0,0)">Email us</span>',
  "<span>PRIVATE_LABEL</span>",
])("accepts locally inspected name source %s", (content) => {
  expect(
    scan(`<a href="mailto:hello@example.test">${content}</a>`).result.findings,
  ).toEqual([]);
});
it.each([
  'aria-label=" "',
  'aria-labelledby="missing"',
  'aria-labelledby="empty"',
  'aria-label=""',
])("detects empty or broken naming %s", (attr) => {
  expect(
    scan(
      `<span id="empty"></span><a href="mailto:hello@example.test" ${attr}></a>`,
    ).result.findings[0]?.category,
  ).toBe("accessible-name");
});
it("respects resolved empty labelledby over other naming sources", () => {
  expect(
    scan(
      '<span id="empty"></span><a href="mailto:hello@example.test" aria-labelledby="empty" aria-label="Email us">Email us</a>',
    ).result.findings[0]?.category,
  ).toBe("accessible-name");
});
it("defers chained labelledby references instead of losing referenced text", () => {
  expect(
    scan(
      '<span id="empty"></span><span id="label" aria-labelledby="empty">Email us</span><a href="mailto:hello@example.test" aria-labelledby="label"></a>',
    ).result.findings,
  ).toEqual([]);
});
it.each([
  '<a href="mailto:hello@example.test" aria-labelledby="cycle" id="cycle"></a>',
  '<a href="mailto:hello@example.test"><svg><use href="#icon"/></svg></a>',
  '<a href="mailto:hello@example.test"><custom-icon/></a>',
  '<a href="mailto:hello@example.test" hidden></a>',
  '<a href="mailto:hello@example.test" role="button"></a>',
  '<label for="call">Call us</label><button id="call" data-href="tel:+919876543210"></button>',
  '<a href="mailto:hello@example.test"><span contenteditable="true">PRIVATE_FORM</span></a>',
])("defers unsupported or ambiguous names %s", (markup) => {
  expect(scan(markup).result.findings).toEqual([]);
});
it("groups only unnamed occurrences and maps highlighting to the first unnamed control", () => {
  const { result, elements } = scan(
    '<a href="mailto:hello@example.test">Email us</a><a href="mailto:hello@example.test"></a><a href="mailto:hello@example.test"></a><a href="/ordinary"><svg/></a>',
  );
  expect(result.inspected).toBe(4);
  expect(result.findings).toHaveLength(1);
  expect(result.findings[0].count).toBe(2);
  expect(elements.get(0)).toBe(document.querySelectorAll("a")[1]);
  expect(
    summarize(
      filterFindings(result.findings, "accessible-name", "warning", "contact"),
    ),
  ).toMatchObject({ groups: 1, occurrences: 2, warnings: 1 });
  expect(filterFindings(result.findings, "all", "all", "general")).toEqual([]);
});
it("preserves malformed URL errors alongside the separate name warning and redacts exports", () => {
  const { result } = scan('<a href="mailto:bad?body=PRIVATE_BODY"></a>');
  expect(result.findings.map((f) => [f.category, f.severity])).toEqual([
    ["email", "error"],
    ["accessible-name", "warning"],
  ]);
  expect(JSON.parse(jsonReport(result))).toMatchObject({
    schemaVersion: 1,
    contactFindings: [{ category: "email" }, { category: "accessible-name" }],
    generalObservations: [],
  });
  expect(report(result)).toContain("[WARNING] accessible-name");
  expect(report(result)).toContain("not a complete accessibility audit");
  expect(jsonReport(result) + report(result)).not.toContain("PRIVATE_");
  expect(jsonReport(result)).toBe(
    jsonReport(inspect(document, "other").result),
  );
});
it("defers oversized name trees and references without changing bounded limits", () => {
  expect(
    scan(
      '<a href="mailto:hello@example.test">' +
        "<span></span>".repeat(40) +
        "</a>",
    ).result.findings,
  ).toEqual([]);
  expect(
    scan('<a href="mailto:hello@example.test" aria-labelledby="a b c d e"></a>')
      .result.findings,
  ).toEqual([]);
  const markup = Array.from(
    { length: 260 },
    (_, i) => `<a href="mailto:bad${i}"></a>`,
  ).join("");
  const { result, elements } = scan(markup);
  expect(result.findings).toHaveLength(250);
  expect(result.findings.every((f) => f.category === "email")).toBe(true);
  expect(result.truncated).toBe(true);
  expect(elements.size).toBe(250);
});
