// @vitest-environment jsdom
import { beforeEach, describe, it, expect } from "vitest";
import { inspect } from "../src/scan";
import { report, summarize, filterFindings } from "../src/report";
import { redact } from "../src/privacy";
import { classifyIntent } from "../src/intent";
beforeEach(() => document.body.replaceChildren());
const scan = (html: string) => {
  document.body.innerHTML = html;
  return inspect(document, "test").result;
};
describe("deterministic contact intent", () => {
  it("does not inherit destination intent from the page origin for empty and fragment placeholders", () => {
    document.body.innerHTML = "<a>Menu</a>";
    const element = document.querySelector("a")!;
    for (const href of [null, "", "#", "#menu", "undefined", "null"])
      expect(classifyIntent(element, href, "https://wa.me/")).toEqual({
        scope: "general",
        intent: "none",
      });
  });
  it("suggests neutral navigation fixes without changing validator severity", () => {
    const result = scan('<a href="#">Shop</a>');
    expect(result.findings[0]).toMatchObject({
      scope: "general",
      severity: "warning",
      link: "#",
    });
    expect(result.findings[0].fix).not.toContain("contact");
    expect(result.findings[0].fix).toContain("scripted behavior");
  });
  it("does not use editable text as a contact-intent signal", () => {
    const result = scan(
      '<a href="#">Menu<span contenteditable="true">Call us PRIVATE_INPUT</span><span role="textbox">Email us PRIVATE_INPUT</span></a>',
    );
    expect(result.findings[0].scope).toBe("general");
    expect(JSON.stringify(result)).not.toContain("PRIVATE_INPUT");
  });
  it.each([
    "mailto:invalid",
    "tel:call-me",
    "https://wa.me/+invalid",
    "ftp://wa.me/123456789",
  ])("uses destination intent for %s", (href) => {
    const result = scan(`<a href="${href}">Menu</a>`);
    expect(result.findings[0]).toMatchObject({
      scope: "contact",
      intent: "destination",
      severity: "error",
    });
  });
  it.each([
    "Menu",
    "Shop",
    "Contact lenses",
    "Recall products",
    "Support articles",
    "Email newsletter",
    "Contactless delivery",
  ])("keeps ordinary label %s general", (label) => {
    expect(scan(`<a href="#">${label}</a>`).findings[0].scope).toBe("general");
  });
  it.each([
    "Contact",
    "Contact us",
    "Call now",
    "Email us",
    "Message us",
    "WhatsApp support",
    "Get in touch",
    "Request a callback",
  ])("recognizes explicit label %s", (label) => {
    expect(scan(`<a href="#">${label}</a>`).findings[0]).toMatchObject({
      scope: "contact",
      intent: "label-or-context",
      severity: "warning",
    });
  });
  it("uses labelledby, aria-label, nested visible text and image alt locally", () => {
    const result = scan(
      '<span id="call">Call us</span><a href="#" aria-labelledby="call"></a><a href="" aria-label="Email us"></a><a><span>Contact</span><strong> us</strong></a><a href="javascript:void(0)"><img alt="WhatsApp support"></a>',
    );
    expect(result.findings.every((f) => f.scope === "contact")).toBe(true);
    expect(JSON.stringify(result)).not.toContain("WhatsApp support");
  });
  it("respects accessible-name precedence", () => {
    const result = scan(
      '<span id="name">Menu</span><a href="#" aria-labelledby="name" aria-label="Call us">Contact us</a>',
    );
    expect(result.findings[0].scope).toBe("general");
  });
  it("uses bounded labelled contact-group context but not a broad footer/nav", () => {
    const result = scan(
      '<section aria-label="Contact us"><a href="#"></a></section><footer aria-label="Contact us"><a href=""></a></footer><nav aria-label="Contact us"><a></a></nav>',
    );
    expect(result.findings.map((f) => f.scope)).toEqual([
      "contact",
      "general",
      "general",
    ]);
  });
  it("keeps JavaScript contact controls uncertain and never executes them", () => {
    const result = scan(
      '<a href="javascript:throw new Error(\'do not run\')" aria-label="Contact us"></a><button aria-label="Email us"></button>',
    );
    expect(result.findings.map((f) => [f.scope, f.severity])).toEqual([
      ["contact", "warning"],
      ["contact", "info"],
    ]);
    expect(result.findings[0].link).toBe("javascript:[hidden]");
  });
  it("separates duplicate destinations by intent and preserves occurrence totals", () => {
    const result = scan(
      '<a href="#">Shop</a><a href="#">Menu</a><a href="#">Contact us</a><a href="#">Email us</a>',
    );
    expect(result.findings).toHaveLength(2);
    expect(result.findings.map((f) => [f.scope, f.count])).toEqual([
      ["contact", 2],
      ["general", 2],
    ]);
    expect(
      summarize(filterFindings(result.findings, "all", "all", "contact")),
    ).toMatchObject({ groups: 1, occurrences: 2, warnings: 1 });
  });
  it("reproduces the reported 367-element navigation-noise scenario synthetically", () => {
    const result = scan(
      '<a href="#">Menu</a>'.repeat(79) +
        '<a href="javascript:void(0)">Open menu</a>'.repeat(2) +
        "<a>Catalogue</a>" +
        '<a href="/products">Products</a>'.repeat(285),
    );
    expect(result.inspected).toBe(367);
    expect(result.findings.filter((f) => f.scope === "contact")).toHaveLength(
      0,
    );
    expect(summarize(result.findings)).toMatchObject({
      groups: 3,
      occurrences: 82,
      warnings: 2,
      infos: 1,
    });
  });
  it("prioritizes contacts before the group limit without changing the DOM", () => {
    const html =
      Array.from(
        { length: 260 },
        (_, i) => `<a href="javascript:openMenu(${i})">Menu</a>`,
      ).join("") + '<a href="mailto:bad">Email us</a>';
    const result = scan(html);
    expect(result.truncated).toBe(true);
    expect(result.findings).toHaveLength(250);
    expect(result.findings[0]).toMatchObject({
      scope: "contact",
      category: "email",
    });
    expect(document.body.innerHTML).toBe(html);
  });
  it("never reads form values or returns DOM labels", () => {
    const result = scan(
      '<section aria-label="Contact us PRIVATE_LABEL"><a href="mailto:bad?token=PRIVATE_TOKEN">PRIVATE_TEXT</a><input value="PRIVATE_FORM"><textarea>PRIVATE_TEXTAREA</textarea></section>',
    );
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE_/);
  });
  it("keeps reports sectioned, counted and redacted", () => {
    const result = scan(
      '<a href="mailto:bad?body=PRIVATE_BODY&token=PRIVATE_TOKEN">Email us</a><a href="#">Menu</a><a href="#">Shop</a>',
    );
    const text = report(result);
    expect(text).toContain(
      "Contact-related findings: 1 group · 1 affected element",
    );
    expect(text).toContain(
      "General link-quality observations: 1 group · 2 affected elements",
    );
    expect(text.indexOf("Contact-related findings")).toBeLessThan(
      text.indexOf("General link-quality"),
    );
    expect(text).toContain("JavaScript event handlers are not inspected");
    expect(text).not.toMatch(/PRIVATE_/);
  });
  it("redacts malformed multi-at credentials and long authority secrets before clipping", () => {
    expect(redact("https://user:p@ss@host.test?token=secret")).toBe(
      "https://[credentials hidden]@host.test[query/fragment hidden]",
    );
    expect(
      redact("https://user:" + "S".repeat(3000) + "@host.test"),
    ).not.toContain("SSSS");
  });
});
