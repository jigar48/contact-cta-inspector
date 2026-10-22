// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { validate } from "../src/rules";
import { redact } from "../src/privacy";
import { inspect } from "../src/scan";
import { extract } from "../src/extract";
import { filterFindings, report } from "../src/report";
import { supported, scanTab, highlightTab } from "../src/bridge";
import { highlight } from "../src/highlight";
const rule = (value: string | null) =>
  validate(value, "https://example.test/path");
afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe("WhatsApp", () => {
  it.each([
    "https://wa.me/442079460123",
    "https://api.whatsapp.com/send?phone=919876543210&text=Hello",
    "https://wa.me/919876543210?text=a%20b",
  ])("accepts %s", (url) => expect(rule(url)).toBeNull());
  it.each([
    "https://wa.me/+123456789",
    "https://wa.me/01234567",
    "https://wa.me/1234567890123456",
    "https://wa.me/%ZZ",
    "https://wa.me/",
  ])("rejects %s", (url) => expect(rule(url)?.severity).toBe("error"));
  it.each([
    "https://wa.me/message/ABC",
    "https://api.whatsapp.com/send?text=hi",
  ])("explains uncertain route %s", (url) =>
    expect(rule(url)?.severity).toBe("info"),
  );
  it("does not confuse lookalike hosts", () =>
    expect(rule("https://wa.me.evil.test/0")).toBeNull());
  it("warns about short numbers and unknown routes", () => {
    expect(rule("https://wa.me/123")?.severity).toBe("warning");
    expect(rule("https://api.whatsapp.com/unknown")?.severity).toBe("warning");
  });
});
describe("telephone", () => {
  it.each([
    "tel:+44 (20) 7946-0123",
    "tel:+1-202-555-0199;ext=12",
    "tel:%2B442079460123",
  ])("accepts %s", (url) => expect(rule(url)).toBeNull());
  it.each(["tel:", "tel:abc", "tel:+12+34", "tel:%ZZ"])("rejects %s", (url) =>
    expect(rule(url)?.severity).toBe("error"),
  );
  it("explains regional and unusual parameters", () => {
    expect(rule("tel:112")?.severity).toBe("info");
    expect(rule("tel:+123456789;foo=x")?.severity).toBe("warning");
  });
});
describe("email", () => {
  it.each([
    "mailto:a@example.com",
    "mailto:a@example.com,b@example.org?subject=Hello&body=Line%0ABreak",
    "mailto:?to=a@example.com&cc=b@example.com",
    "mailto:%22a%20b%22@example.com",
    "mailto:user@例え.テスト",
  ])("accepts %s", (url) => expect(rule(url)).toBeNull());
  it.each([
    "mailto:bad",
    "mailto:a@@example.com",
    "mailto:a..b@example.com",
    "mailto:a@example.com?subject=x%0ABcc:bad",
    "mailto:%ZZ",
    "mailto:a@",
  ])("rejects %s", (url) => expect(rule(url)?.severity).toBe("error"));
  it("allows recipientless compose", () =>
    expect(rule("mailto:?subject=Hi")?.severity).toBe("info"));
});
describe("placeholder and DOM", () => {
  it.each(["", "#", "javascript:void(0)", "about:blank"])(
    "flags without claiming broken %s",
    (href) => expect(rule(href)?.severity).toBe("warning"),
  );
  it("does not flag relative and fragment links", () => {
    expect(rule("/contact")).toBeNull();
    expect(rule("#contact")).toBeNull();
  });
  it("supports SVG and missing links, ignores form values, groups duplicates", () => {
    document.body.innerHTML =
      '<a href="tel:bad">secret text</a><a href="tel:bad"></a><a></a><svg><a xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="mailto:bad"></a></svg><input value="password"><iframe></iframe>';
    const { result } = inspect(document, "token");
    expect(result.inspected).toBe(4);
    expect(result.findings[0].count).toBe(2);
    expect(result.frames).toBe(1);
    expect(JSON.stringify(result)).not.toContain("password");
    expect(JSON.stringify(result)).not.toContain("secret text");
  });
  it("empty and dynamic pages", () => {
    expect(inspect(document, "t").result.findings).toEqual([]);
    document.body.innerHTML = '<a href="#"></a>';
    expect(inspect(document, "t").result.findings).toHaveLength(1);
  });
  it("bounds large pages and does not modify DOM", () => {
    document.body.innerHTML = '<a href="#"></a>'.repeat(6000);
    const before = document.body.innerHTML;
    expect(extract(document).candidates).toHaveLength(5000);
    expect(inspect(document, "t").result.truncated).toBe(true);
    expect(document.body.innerHTML).toBe(before);
  });
  it("bounds findings and long hrefs", () => {
    document.body.innerHTML = Array.from(
      { length: 300 },
      (_, i) => `<a href="tel:bad${i}"></a>`,
    ).join("");
    expect(inspect(document, "t").result.findings).toHaveLength(250);
    document.body.innerHTML = `<a href="${"x".repeat(5000)}"></a>`;
    expect(inspect(document, "t").result.truncated).toBe(true);
  });
});
describe("privacy and reporting", () => {
  it("hides leading-whitespace script payloads", () =>
    expect(redact("  javascript:secret()")).not.toContain("secret"));
  it("handles mail header case and literal plus addressing", () =>
    expect(
      rule("mailto:?TO=hello+tag@example.com&CC=qa@example.org"),
    ).toBeNull());
  it("redacts all queries, fragments, credentials and scripts", () => {
    expect(
      redact("https://user:pass@example.com/path?token=secret#abc"),
    ).not.toMatch(/pass|secret|abc/);
    expect(redact("javascript:secret()")).toBe("javascript:[hidden]");
  });
  it("filters and reports complete result with privacy", () => {
    document.body.innerHTML =
      '<a href="mailto:bad?body=TOPSECRET"></a><a href="#"></a>';
    const { result } = inspect(document, "t");
    expect(JSON.stringify(result)).not.toContain("TOPSECRET");
    expect(filterFindings(result.findings, "email", "error")).toHaveLength(1);
    expect(filterFindings(result.findings, "all", "info")).toHaveLength(0);
    expect(report(result)).toContain("Top-level DOM only");
    expect(report(result)).not.toContain("TOPSECRET");
  });
});
describe("extension boundary", () => {
  it.each([
    "chrome://settings",
    "https://chromewebstore.google.com/detail/x",
    "https://chrome.google.com/webstore/detail/x",
    "https://a.test/doc.PDF",
    "about:blank",
    undefined,
  ])("rejects unsupported %s", (url) => expect(supported(url)).toBe(false));
  it("accepts regular and file pages", () => {
    expect(supported("https://a.test")).toBe(true);
    expect(supported("file:///demo.html")).toBe(true);
  });
  it("handles missing tabs and injection failures", async () => {
    const query = vi.fn().mockResolvedValue([]),
      executeScript = vi.fn().mockRejectedValue(new Error("denied"));
    vi.stubGlobal("chrome", { tabs: { query }, scripting: { executeScript } });
    await expect(scanTab()).rejects.toThrow("cannot be scanned");
    query.mockResolvedValue([{ id: 1, url: "https://example.test" }]);
    await expect(scanTab()).rejects.toThrow("could not access");
  });
  it("requires a result and targets only the active top frame", async () => {
    const executeScript = vi
      .fn()
      .mockResolvedValue([{ result: { findings: [], token: "t" } }]);
    vi.stubGlobal("chrome", {
      tabs: {
        query: vi.fn().mockResolvedValue([{ id: 4, url: "https://a.test" }]),
      },
      scripting: { executeScript },
    });
    expect((await scanTab()).tabId).toBe(4);
    expect(executeScript.mock.calls[0][0].target).toEqual({ tabId: 4 });
    executeScript.mockResolvedValue([]);
    await expect(scanTab()).rejects.toThrow();
    expect(await highlightTab(4, 1, "t")).toBe(false);
  });
  it("highlights temporarily without changing element styles and rejects stale tokens", () => {
    vi.useFakeTimers();
    const a = document.createElement("a");
    document.body.append(a);
    a.getBoundingClientRect = () =>
      ({ left: 2, top: 3, width: 20, height: 10 }) as DOMRect;
    vi.stubGlobal("__ctaInspector", {
      elements: new Map([[0, a]]),
      token: "t",
    });
    expect(highlight(0, "wrong")).toBe(false);
    expect(highlight(0, "t")).toBe(true);
    expect(
      document.documentElement.lastElementChild?.getAttribute("aria-hidden"),
    ).toBe("true");
    expect(a.getAttribute("style")).toBeNull();
    vi.advanceTimersByTime(3001);
    expect(document.querySelector("[aria-hidden]")).toBeNull();
    expect(highlight(0, "t")).toBe(true);
    window.dispatchEvent(new Event("scroll"));
    expect(document.querySelector("[aria-hidden]")).toBeNull();
    a.remove();
    expect(highlight(0, "t")).toBe(false);
  });
});
it.each([
  "https:user:PRIVATE_PASSWORD@wa.me/0?token=PRIVATE_QUERY#PRIVATE_FRAGMENT",
  "https:\\user:PRIVATE_PASSWORD@wa.me/0?token=PRIVATE_QUERY#PRIVATE_FRAGMENT",
])(
  "redacts browser-normalized credentials before findings leave the page: %s",
  (href) => {
    document.body.innerHTML = "<a>Contact us</a>";
    document.querySelector("a")!.setAttribute("href", href);
    const { result } = inspect(document, "synthetic-token");
    expect(result.findings).toHaveLength(1);
    expect(JSON.stringify(result.findings)).not.toContain("PRIVATE_");
    expect(result.findings[0].link).toContain("[credentials hidden]");
  },
);
