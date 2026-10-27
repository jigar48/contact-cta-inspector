// @vitest-environment jsdom
import { it, expect, vi, beforeEach } from "vitest";
beforeEach(() => vi.resetModules());
async function mount(
  findings: unknown[] = [],
  inspected = 9,
  truncated = false,
) {
  vi.resetModules();
  document.body.innerHTML = '<div id="app"></div>';
  const executeScript = vi.fn().mockResolvedValue([
    {
      result: {
        findings,
        inspected,
        frames: 2,
        truncated,
        page: "https://a.test",
        token: "t",
      },
    },
  ]);
  vi.stubGlobal("chrome", {
    tabs: {
      query: vi.fn().mockResolvedValue([{ id: 1, url: "https://a.test" }]),
    },
    scripting: { executeScript },
  });
  await import("../src/popup");
  return executeScript;
}
const finding = {
  scope: "contact",
  intent: "destination",
  id: 0,
  category: "email",
  severity: "error",
  link: "mailto:bad",
  explanation: "Invalid recipient",
  fix: "Use a complete address.",
  count: 3,
};
it("provides a compact initial state and labelled native controls", async () => {
  const execute = await mount();
  expect(document.querySelector("h1")?.textContent).toBe(
    "Contact CTA Inspector",
  );
  expect(document.querySelector("header #scan")).not.toBeNull();
  expect(document.getElementById("app")?.dataset.state).toBe("initial");
  expect(document.getElementById("initial")?.hidden).toBe(false);
  expect(execute).not.toHaveBeenCalled();
  expect(
    document.querySelector<HTMLSelectElement>("#category")?.labels?.length,
  ).toBe(1);
  expect(document.getElementById("findings")?.getAttribute("tabindex")).toBe(
    "0",
  );
});
it("shows loading feedback and prevents duplicate scans", async () => {
  const execute = await mount();
  let release: (value: unknown) => void = () => {};
  execute.mockImplementation(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  document.getElementById("scan")!.click();
  await vi.waitFor(() => expect(execute).toHaveBeenCalled());
  expect((document.getElementById("scan") as HTMLButtonElement).disabled).toBe(
    true,
  );
  expect(document.getElementById("app")?.dataset.state).toBe("scanning");
  expect(document.getElementById("results")?.getAttribute("aria-busy")).toBe(
    "true",
  );
  document.getElementById("scan")!.click();
  expect(execute).toHaveBeenCalledTimes(1);
  release([
    {
      result: {
        findings: [],
        inspected: 0,
        frames: 0,
        truncated: false,
        page: "https://a.test",
        token: "t",
      },
    },
  ]);
  await vi.waitFor(() =>
    expect(document.getElementById("app")?.dataset.state).toBe("empty"),
  );
});
it("keeps summary counts independent of filters and exposes grouped elements", async () => {
  await mount(
    [
      finding,
      {
        ...finding,
        id: 1,
        category: "telephone",
        severity: "warning",
        count: 1,
      },
    ],
    23,
    true,
  );
  document.getElementById("scan")!.click();
  await vi.waitFor(() =>
    expect(document.querySelectorAll("article")).toHaveLength(2),
  );
  expect(document.getElementById("inspected")?.textContent).toBe("23");
  expect(document.getElementById("errors")?.textContent).toBe("1");
  expect(document.getElementById("warnings")?.textContent).toBe("1");
  expect(document.querySelector(".occurrences")?.textContent).toBe(
    "3 elements",
  );
  expect(document.getElementById("limit")?.hidden).toBe(false);
  const category = document.getElementById("category") as HTMLSelectElement;
  category.value = "email";
  category.dispatchEvent(new Event("change"));
  expect(document.getElementById("shown")?.textContent).toBe(
    "1 of 2 groups · 3 elements",
  );
  expect(document.getElementById("warnings")?.textContent).toBe("1");
  expect(
    document.querySelector(".locate")?.getAttribute("aria-label"),
  ).toContain("Email");
});
it("distinguishes a clean scan from an empty filter and exposes zero counts", async () => {
  await mount();
  document.getElementById("scan")!.click();
  await vi.waitFor(() =>
    expect(document.getElementById("app")?.dataset.state).toBe("empty"),
  );
  expect(document.querySelector(".empty strong")?.textContent).toBe(
    "No contact findings detected",
  );
  expect(document.getElementById("errors")?.textContent).toBe("0");
  expect(document.getElementById("initial")?.hidden).toBe(true);
});
it("handles highlight failure and recovery without discarding results", async () => {
  const execute = await mount([finding]);
  document.getElementById("scan")!.click();
  await vi.waitFor(() =>
    expect(document.querySelector(".locate")).not.toBeNull(),
  );
  execute.mockRejectedValue(new Error("gone"));
  (document.querySelector(".locate") as HTMLButtonElement).click();
  await vi.waitFor(() =>
    expect(document.getElementById("status")?.textContent).toContain(
      "access was lost",
    ),
  );
  expect(document.querySelectorAll("article")).toHaveLength(1);
});
it("waits for click, safely renders, filters, copies and reports failures", async () => {
  document.body.innerHTML = '<div id="app"></div>';
  const executeScript = vi.fn().mockResolvedValue([
    {
      result: {
        findings: [
          {
            id: 0,
            scope: "contact",
            intent: "destination",
            category: "email",
            severity: "error",
            link: "<img src=x onerror=alert(1)>",
            explanation: "Bad recipient",
            fix: "Correct mailbox",
            count: 1,
          },
        ],
        inspected: 1,
        frames: 0,
        truncated: false,
        page: "https://a.test",
        token: "t",
      },
    },
  ]);
  vi.stubGlobal("chrome", {
    tabs: {
      query: vi.fn().mockResolvedValue([{ id: 1, url: "https://a.test" }]),
    },
    scripting: { executeScript },
  });
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
  await import("../src/popup");
  expect(executeScript).not.toHaveBeenCalled();
  document.getElementById("scan")!.click();
  await vi.waitFor(() =>
    expect(document.querySelectorAll("article")).toHaveLength(1),
  );
  expect(document.querySelector("img")).toBeNull();
  const select = document.getElementById("severity") as HTMLSelectElement;
  select.value = "info";
  select.dispatchEvent(new Event("change"));
  expect(document.querySelectorAll("article")).toHaveLength(0);
  document.getElementById("copy")!.click();
  await vi.waitFor(() => expect(writeText).toHaveBeenCalled());
  writeText.mockRejectedValue(new Error("no clipboard"));
  document.getElementById("copy")!.click();
  await vi.waitFor(() =>
    expect((document.getElementById("fallback") as HTMLElement).hidden).toBe(
      false,
    ),
  );
  executeScript.mockRejectedValue(new Error("denied"));
  document.getElementById("scan")!.click();
  await vi.waitFor(() =>
    expect(document.getElementById("status")!.textContent).toContain(
      "could not access",
    ),
  );
  expect((document.getElementById("scan") as HTMLButtonElement).disabled).toBe(
    false,
  );
});
it("defaults to contact findings and keeps navigation noise out of contact counts", async () => {
  await mount([
    finding,
    {
      ...finding,
      id: 1,
      category: "placeholder",
      scope: "general",
      intent: "none",
      severity: "warning",
      link: "#",
      count: 79,
    },
  ]);
  document.getElementById("scan")!.click();
  await vi.waitFor(() =>
    expect(document.querySelectorAll("article")).toHaveLength(1),
  );
  expect((document.getElementById("view") as HTMLSelectElement).value).toBe(
    "contact",
  );
  expect(document.getElementById("warnings")?.textContent).toBe("0");
  expect(document.getElementById("shown")?.textContent).toBe(
    "1 of 1 group · 3 elements",
  );
  expect(
    document.querySelector('option[value="general"]')?.textContent,
  ).toContain("1 group / 79 elements");
  const view = document.getElementById("view") as HTMLSelectElement;
  view.value = "general";
  view.dispatchEvent(new Event("change"));
  expect(document.querySelectorAll("article")).toHaveLength(1);
  expect(document.getElementById("errors")?.textContent).toBe("0");
  expect(document.getElementById("warnings")?.textContent).toBe("1");
  expect(document.getElementById("section-title")?.textContent).toBe(
    "General observations",
  );
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
  document.getElementById("copy")!.click();
  await vi.waitFor(() => expect(writeText).toHaveBeenCalled());
  expect(writeText.mock.calls[0][0]).toContain("Contact-related findings");
  expect(writeText.mock.calls[0][0]).toContain(
    "General link-quality observations",
  );
  document.getElementById("scan")!.click();
  await vi.waitFor(() =>
    expect((document.getElementById("view") as HTMLSelectElement).value).toBe(
      "contact",
    ),
  );
});
it("presents a general-only scan without implying contact errors", async () => {
  await mount([
    {
      ...finding,
      scope: "general",
      intent: "none",
      severity: "warning",
      category: "placeholder",
      count: 82,
    },
  ]);
  document.getElementById("scan")!.click();
  await vi.waitFor(() =>
    expect(document.querySelector(".empty strong")?.textContent).toBe(
      "No contact findings detected",
    ),
  );
  expect(document.querySelectorAll("article")).toHaveLength(0);
  expect(document.getElementById("warnings")?.textContent).toBe("0");
  expect(document.getElementById("shown")?.textContent).toBe(
    "0 of 0 groups · 0 elements",
  );
});
it("copies all JSON sections independently of every UI filter and supports a focused fallback", async () => {
  await mount([
    finding,
    { ...finding, scope: "general", intent: "none", category: "placeholder" },
  ]);
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
  document.getElementById("scan")!.click();
  await vi.waitFor(() =>
    expect(document.querySelectorAll("article")).toHaveLength(1),
  );
  for (const [id, value] of [
    ["category", "telephone"],
    ["severity", "info"],
    ["view", "general"],
  ]) {
    const select = document.getElementById(id) as HTMLSelectElement;
    select.value = value;
    select.dispatchEvent(new Event("change"));
  }
  document.getElementById("copy-json")!.click();
  await vi.waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
  const text = writeText.mock.calls[0][0];
  expect(JSON.parse(text).contactFindings).toHaveLength(1);
  expect(JSON.parse(text).generalObservations).toHaveLength(1);
  writeText.mockRejectedValue(new Error("denied"));
  document.getElementById("copy-json")!.click();
  await vi.waitFor(() =>
    expect(document.getElementById("fallback")?.hidden).toBe(false),
  );
  const area = document.getElementById("report") as HTMLTextAreaElement;
  expect(document.activeElement).toBe(area);
  expect(area.getAttribute("aria-label")).toBe("Redacted JSON report");
  expect(area.value).toBe(text);
  expect(area.selectionEnd).toBe(text.length);
  writeText.mockResolvedValue(undefined);
  document.getElementById("copy-json")!.click();
  await vi.waitFor(() =>
    expect(document.getElementById("fallback")?.hidden).toBe(true),
  );
  document.getElementById("scan")!.click();
  expect(area.value).toBe("");
});
it("exports empty JSON when the clipboard API is missing", async () => {
  await mount();
  Object.defineProperty(navigator, "clipboard", {
    value: undefined,
    configurable: true,
  });
  document.getElementById("scan")!.click();
  await vi.waitFor(() =>
    expect(document.getElementById("results")?.hidden).toBe(false),
  );
  document.getElementById("copy-json")!.click();
  await vi.waitFor(() =>
    expect(document.getElementById("fallback")?.hidden).toBe(false),
  );
  expect(
    JSON.parse((document.getElementById("report") as HTMLTextAreaElement).value)
      .contactFindings,
  ).toEqual([]);
});
it("reports oversized export failure without writing partial JSON", async () => {
  await mount([{ ...finding, explanation: "x".repeat(4097) }]);
  const writeText = vi.fn();
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
  document.getElementById("scan")!.click();
  await vi.waitFor(() =>
    expect(document.querySelectorAll("article")).toHaveLength(1),
  );
  document.getElementById("copy-json")!.click();
  expect(document.getElementById("status")?.textContent).toContain(
    "invalid or oversized",
  );
  expect(writeText).not.toHaveBeenCalled();
});
it("does not restore an old fallback after a re-scan", async () => {
  await mount([finding]);
  let rejectCopy: (reason: Error) => void = () => {};
  const writeText = vi.fn(
    () =>
      new Promise<void>((_resolve, reject) => {
        rejectCopy = reject;
      }),
  );
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
  document.getElementById("scan")!.click();
  await vi.waitFor(() =>
    expect(document.querySelectorAll("article")).toHaveLength(1),
  );
  document.getElementById("copy-json")!.click();
  document.getElementById("scan")!.click();
  rejectCopy(new Error("late denial"));
  await vi.waitFor(() =>
    expect(document.getElementById("results")?.hidden).toBe(false),
  );
  expect(document.getElementById("fallback")?.hidden).toBe(true);
  expect((document.getElementById("report") as HTMLTextAreaElement).value).toBe(
    "",
  );
});

it("filters and highlights accessible-name warnings using existing controls", async () => {
  const execute = await mount([
    { ...finding, category: "accessible-name", severity: "warning" },
  ]);
  document.getElementById("scan")!.click();
  await vi.waitFor(() =>
    expect(document.querySelectorAll("article")).toHaveLength(1),
  );
  const category = document.getElementById("category") as HTMLSelectElement;
  category.value = "accessible-name";
  category.dispatchEvent(new Event("change"));
  expect(
    document.querySelector("article h3")?.textContent ??
      document.querySelector("article")?.textContent,
  ).toContain("Accessible name");
  (document.querySelector(".locate") as HTMLButtonElement).click();
  await vi.waitFor(() => expect(execute).toHaveBeenCalledTimes(2));
  expect(execute.mock.calls[1][0].args).toEqual([0, "t"]);
  category.value = "email";
  category.dispatchEvent(new Event("change"));
  expect(document.querySelectorAll("article")).toHaveLength(0);
  expect(document.getElementById("warnings")?.textContent).toBe("1");
});
