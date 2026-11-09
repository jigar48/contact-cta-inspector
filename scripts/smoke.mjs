import { chromium } from "playwright-core";
import { mkdtemp, readFile, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { createServer } from "node:http";
import assert from "node:assert/strict";
import { URL } from "node:url";
import { chromePath } from "./chrome-path.mjs";

async function fieldBorderContrast(field) {
  return field.evaluate((el) => {
    function luminance(color) {
      const weights = [0.2126, 0.7152, 0.0722];
      return color.match(/\d+/g).reduce((sum, channel, index) => {
        const srgb = Number(channel) / 255;
        const linear =
          srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
        return sum + linear * weights[index];
      }, 0);
    }
    const style = window.getComputedStyle(el);
    return (
      (luminance(style.backgroundColor) + 0.05) /
      (luminance(style.borderTopColor) + 0.05)
    );
  });
}

const profile = await mkdtemp(join(tmpdir(), "cta-chrome-"));
const chrome = chromePath();
const server = createServer(async (req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.end(
    req.url === "/noise"
      ? "<!doctype html><title>Navigation noise fixture</title>" +
          '<a href="#">Menu</a>'.repeat(79) +
          '<a href="javascript:void(0)">Open menu</a>'.repeat(2) +
          "<a>Catalogue</a>" +
          '<a href="/products">Products</a>'.repeat(285)
      : req.url === "/empty"
        ? "<!doctype html><html><title>Empty fixture</title><p>No contact links</p></html>"
        : await readFile("public/demo.html"),
  );
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
let context;
try {
  context = await chromium.launchPersistentContext(profile, {
    executablePath: chrome,
    headless: true,
    ignoreDefaultArgs: ["--disable-extensions"],
    args: ["--enable-unsafe-extension-debugging", "--no-first-run"],
  });
  const page = await context.newPage();
  const cdp = await context.browser().newBrowserCDPSession();
  const version = await cdp.send("Browser.getVersion");
  console.log(version.product);
  const { id } = await cdp.send("Extensions.loadUnpacked", {
    path: resolve("dist"),
  });
  const fixture = `http://127.0.0.1:${server.address().port}/`;
  await page.goto(fixture);
  const scanner = await readFile("dist/scanner.js", "utf8");
  const scanned = await page.evaluate(scanner);
  assert.equal(scanned.inspected, 19);
  const nameWarnings = scanned.findings.filter(
    (f) => f.category === "accessible-name",
  );
  assert.equal(nameWarnings.length, 1);
  assert.equal(nameWarnings[0].count, 1);
  assert.equal(nameWarnings[0].severity, "warning");
  const naming = await context.newPage();
  await naming.goto(fixture);
  await naming.setContent(`<!doctype html><style>.generated::before { content: "Call us"; }</style>
    <a href="tel:+919876543210" class="generated"></a>
    <a href="mailto:hello@example.test"><svg><title>Email us</title></svg></a>
    <span id="name" hidden>Call us</span><a href="tel:+919876543210" aria-labelledby="name"></a>
    <a href="tel:+919876543210"><span style="position:absolute;clip:rect(0,0,0,0)">Call us</span></a>`);
  assert.equal((await naming.evaluate(scanner)).findings.length, 0);
  await naming.close();
  const contactCount = scanned.findings.filter(
    (f) => f.scope === "contact",
  ).length;
  const generalCount = scanned.findings.filter(
    (f) => f.scope === "general",
  ).length;
  assert(
    scanned.findings.some(
      (f) => f.category === "whatsapp" && f.severity === "error",
    ),
  );
  assert(!JSON.stringify(scanned).includes("PRIVATE_DEMO_"));
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${id}/index.html`);
  assert.equal(
    await popup.locator("h1").textContent(),
    "Contact CTA Inspector",
  );
  assert.match(
    await popup.locator("#status").textContent(),
    /Nothing is scanned automatically/,
  );
  await mkdir("docs/screenshots", { recursive: true });
  await popup.setViewportSize({ width: 416, height: 650 });
  await popup.screenshot({ path: "docs/screenshots/popup-empty.png" });
  // Extension popup is opened as a tab here. This tests Chrome's real refusal path, not an action-granted activeTab scan.
  await popup.locator("#scan").press("Enter");
  await popup.waitForFunction(
    () => !document.querySelector("#scan").hasAttribute("aria-disabled"),
  );
  const failure = await popup.locator("#status").textContent();
  assert.match(failure, /cannot be scanned|could not access/);
  assert.equal(await popup.evaluate(() => document.activeElement.id), "scan");
  await mkdir("docs/screenshots", { recursive: true });
  await popup.setViewportSize({ width: 416, height: 650 });
  await popup.screenshot({ path: "docs/screenshots/popup-error.png" });
  const { targetInfos } = await cdp.send("Target.getTargets", {
    filter: [{ type: "tab" }],
  });
  const targetInfo = targetInfos.find((t) => t.url === fixture);
  assert(targetInfo, "Fixture tab target must exist");
  const popupSession = await context.newCDPSession(popup);
  const { targetInfo: existingPopup } = await popupSession.send(
    "Target.getTargetInfo",
  );
  let nativeSessionId;
  async function openNativePopup() {
    await page.bringToFront();
    await cdp.send("Extensions.triggerAction", {
      id,
      targetId: targetInfo.targetId,
    });
    let target;
    for (let attempt = 0; attempt < 60 && !target; attempt++) {
      target = (await cdp.send("Target.getTargets")).targetInfos.find(
        (t) =>
          t.type === "page" &&
          t.url === popup.url() &&
          t.targetId !== existingPopup.targetId,
      );
      if (!target) await page.waitForTimeout(50);
    }
    assert(target, "Chrome must open the action popup");
    ({ sessionId: nativeSessionId } = await cdp.send("Target.attachToTarget", {
      targetId: target.targetId,
      flatten: false,
    }));
    await nativeSend("Runtime.runIfWaitingForDebugger");
    await page.waitForTimeout(300);
  }
  let commandId = 0;
  const nativeSend = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++commandId;
      const listener = (event) => {
        if (event.sessionId !== nativeSessionId) return;
        const msg = JSON.parse(event.message);
        if (msg.id !== id) return;
        cdp.off("Target.receivedMessageFromTarget", listener);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      };
      cdp.on("Target.receivedMessageFromTarget", listener);
      cdp
        .send("Target.sendMessageToTarget", {
          sessionId: nativeSessionId,
          message: JSON.stringify({ id, method, params }),
        })
        .catch(reject);
    });
  const nativeEval = async (expression) => {
    const value = await nativeSend("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (value.exceptionDetails) throw new Error(value.exceptionDetails.text);
    return value.result.value;
  };
  async function nativeKey(key, code, windowsVirtualKeyCode, text, modifiers) {
    const params = { key, code, windowsVirtualKeyCode, modifiers };
    await nativeSend("Input.dispatchKeyEvent", {
      ...params,
      type: text ? "keyDown" : "rawKeyDown",
      text,
    });
    await nativeSend("Input.dispatchKeyEvent", { ...params, type: "keyUp" });
  }
  const nativeFocus = () => nativeEval("document.activeElement.id");
  const nativeZoomRatio = () => nativeEval("devicePixelRatio");
  await openNativePopup();
  const nativeDefaultDpr = await nativeZoomRatio();
  const nativeInitial = await nativeEval(
    "({width:innerWidth,height:innerHeight,root:document.documentElement.getBoundingClientRect().width,body:document.body.getBoundingClientRect().width})",
  );
  assert.equal(nativeInitial.width, 416);
  await writeFile(
    "docs/screenshots/popup-native-initial.png",
    Buffer.from((await nativeSend("Page.captureScreenshot")).data, "base64"),
  );
  await nativeKey("Tab", "Tab", 9);
  assert.equal(await nativeFocus(), "scan");
  await nativeKey("Enter", "Enter", 13, "\r");
  await page.waitForTimeout(250);
  assert.equal(await nativeFocus(), "scan");
  const nativeScanned = await nativeEval(
    '({width:innerWidth,height:innerHeight,cards:document.querySelectorAll("article").length,findings:document.querySelector("#findings").getBoundingClientRect().toJSON()})',
  );
  assert.equal(nativeScanned.width, 416);
  assert(nativeScanned.findings.height > 150);
  const nativeLayout = await nativeEval(
    '({heading:document.querySelector("h1").getBoundingClientRect().height,footer:document.querySelector("footer").getBoundingClientRect().bottom,app:document.querySelector("#app").getBoundingClientRect().height,button:document.querySelector("#scan").getBoundingClientRect().height})',
  );
  assert.equal(nativeLayout.heading, 20);
  assert(nativeLayout.footer <= nativeScanned.height + 1);
  assert(nativeLayout.button <= 32);
  assert(
    (await nativeEval(
      'document.querySelector("#copy-safe").getBoundingClientRect().bottom',
    )) <= nativeScanned.height,
  );
  const nativeScroll = await nativeEval(
    '(()=>{const el=document.querySelector("#findings");el.scrollTop=150;return el.scrollTop;})()',
  );
  assert(nativeScroll > 0);
  await nativeEval('document.querySelector("#findings").scrollTop=0');
  for (const id of ["view", "category", "severity", "findings"]) {
    await nativeKey("Tab", "Tab", 9);
    assert.equal(await nativeFocus(), id);
  }
  assert.equal(
    await nativeEval("getComputedStyle(document.activeElement).outlineOffset"),
    "-2px",
  );
  const { nodes } = await nativeSend("Accessibility.getFullAXTree");
  assert(
    nodes.some(
      (n) => n.role.value === "region" && n.name?.value === "Contact findings",
    ),
  );
  assert(
    nodes.some(
      (n) =>
        n.role.value === "button" &&
        n.name?.value.startsWith("Copy both sections"),
    ),
  );
  assert.equal(nativeScanned.cards, contactCount);
  await nativeEval(
    '(()=>{const view=document.querySelector("#view");view.value="general";view.dispatchEvent(new Event("change"));})()',
  );
  assert.equal(
    await nativeEval('document.querySelectorAll("article").length'),
    generalCount,
  );
  assert.equal(
    await nativeEval('document.querySelector("#errors").textContent'),
    "0",
  );
  await writeFile(
    "docs/screenshots/popup-native-general.png",
    Buffer.from((await nativeSend("Page.captureScreenshot")).data, "base64"),
  );
  await nativeEval(
    '(()=>{const view=document.querySelector("#view");view.value="contact";view.dispatchEvent(new Event("change"));})()',
  );
  await writeFile(
    "docs/screenshots/popup-native-results.png",
    Buffer.from((await nativeSend("Page.captureScreenshot")).data, "base64"),
  );
  await nativeEval(
    '(()=>{const c=document.querySelector("#category"),s=document.querySelector("#severity");c.value="email";s.value="warning";s.dispatchEvent(new Event("change"));})()',
  );
  await page.waitForTimeout(200);
  assert.equal(
    await nativeEval('document.querySelectorAll("article").length'),
    0,
  );
  await nativeEval(
    '(()=>{const c=document.querySelector("#category"),s=document.querySelector("#severity");c.value="all";s.value="all";s.dispatchEvent(new Event("change"));})()',
  );
  await page.waitForTimeout(200);
  assert(
    (await nativeEval('document.querySelector("#findings").clientHeight')) >
      150,
  );
  // The action grants activeTab. Invoke the real popup controller in its background tab while the fixture remains active.
  await page.bringToFront();
  await popup.evaluate(() => document.querySelector("#scan").click());
  await popup.locator("article").first().waitFor();
  assert.equal(await popup.locator("article").count(), contactCount);
  await popup.screenshot({ path: "docs/screenshots/popup-results.png" });
  const beforeHighlight = await page.locator("body").innerHTML();
  await popup.locator(".locate").first().click();
  await popup.waitForFunction(() =>
    document.querySelector("#status").textContent.includes("Highlighted"),
  );
  await page.waitForTimeout(150);
  assert.equal(await page.locator('html > div[aria-hidden="true"]').count(), 1);
  await page.evaluate(() => window.dispatchEvent(new Event("resize")));
  assert.equal(await page.locator('html > div[aria-hidden="true"]').count(), 0);
  assert.equal(await page.locator("body").innerHTML(), beforeHighlight);
  await popup.locator("#category").selectOption("email");
  assert.equal(
    await popup.locator("article").count(),
    scanned.findings.filter((f) => f.category === "email").length,
  );
  // Capture each export after the real clipboard write succeeds.
  await popup.bringToFront();
  await popup.evaluate(() => {
    const write = window.navigator.clipboard.writeText.bind(
      window.navigator.clipboard,
    );
    window.navigator.clipboard.writeText = async (text) => {
      await write(text);
      window.smokeCopiedText = text;
    };
  });
  await popup.locator("#copy").click();
  await popup.waitForFunction(
    () =>
      document.querySelector("#status").textContent ===
      "Full redacted report copied.",
  );
  const copyStatus = await popup.locator("#status").textContent();
  const copiedReport = await popup.evaluate(() => window.smokeCopiedText);
  assert.match(copiedReport, /mailto:missing-at\[query\/fragment hidden\]/);
  await popup.locator("#copy-json").click();
  await popup.waitForFunction(
    () =>
      document.querySelector("#status").textContent ===
      "JSON for both sections copied.",
  );
  const copiedJson = await popup.evaluate(() => window.smokeCopiedText);
  const structured = JSON.parse(copiedJson);
  assert.equal(structured.schemaVersion, 1);
  assert.equal(structured.contactFindings.length, contactCount);
  assert.equal(structured.generalObservations.length, generalCount);
  assert(!copiedJson.includes("PRIVATE_DEMO_"));
  assert(
    structured.contactFindings.some(
      (f) => f.destination === "mailto:missing-at[query/fragment hidden]",
    ),
  );
  await popup.locator("#view").selectOption("general");
  await popup.locator("#severity").selectOption("error");
  assert.equal(await popup.locator("article").count(), 0);
  await popup.locator("#copy-safe").press("Enter");
  await popup.waitForFunction(
    () =>
      document.querySelector("#status").textContent === "Safe summary copied.",
  );
  const copiedSafeSummary = await popup.evaluate(() => window.smokeCopiedText);
  assert.equal(
    await popup.evaluate(() => document.activeElement.id),
    "copy-safe",
  );
  assert.match(copiedSafeSummary, /Elements inspected — 19\./);
  assert.match(
    copiedSafeSummary,
    /Contact-related findings\nFinding groups — 10\./,
  );
  assert.match(
    copiedSafeSummary,
    /General link-quality observations\nFinding groups — 3\. Occurrences — 4\./,
  );
  assert.doesNotMatch(
    copiedSafeSummary,
    /https?:|127\.0\.0\.1|wa\.me|mailto:|tel:|missing-at|PRIVATE_DEMO_|919876543210/,
  );
  // Exercise denied clipboard access deterministically in the packaged popup.
  await popup.evaluate(() => {
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error("Synthetic denial");
        },
      },
    });
  });
  await popup.locator("#copy-json").press("Space");
  await popup.locator("#fallback").waitFor({ state: "visible" });
  assert.equal(await popup.locator("#report").inputValue(), copiedJson);
  assert((await fieldBorderContrast(popup.locator("#report"))) >= 3);
  assert((await fieldBorderContrast(popup.locator("#category"))) >= 3);
  assert.equal(await popup.evaluate(() => document.activeElement.id), "report");
  assert.match(
    await popup.locator("#status").textContent(),
    /Clipboard unavailable/,
  );
  assert.equal(
    await popup.locator("#report").evaluate((el) => el.selectionEnd),
    copiedJson.length,
  );
  await popup.locator("#copy-safe").click();
  await popup.locator("#fallback").waitFor({ state: "visible" });
  assert.equal(await popup.locator("#report").inputValue(), copiedSafeSummary);
  assert.equal(
    await popup.locator("#report").getAttribute("aria-label"),
    "Safe summary",
  );
  assert.equal(await popup.evaluate(() => document.activeElement.id), "report");
  assert.equal(
    await popup.locator("#report").evaluate((el) => el.selectionEnd),
    copiedSafeSummary.length,
  );
  await popup.evaluate(() => {
    delete window.navigator.clipboard;
  });
  await popup.locator("#view").selectOption("contact");
  await popup.locator("#severity").selectOption("all");
  await popup.locator("#category").selectOption("all");
  await popup.locator("#copy-safe").click();
  await popup.getByText("Safe summary copied.", { exact: true }).waitFor();
  assert.equal(
    await popup.evaluate(() => window.smokeCopiedText),
    copiedSafeSummary,
  );
  assert(await popup.locator("#fallback").isHidden());
  await popup.bringToFront();
  await popup.locator("#scan").focus();
  await popup.keyboard.press("Tab");
  assert.equal(await popup.evaluate(() => document.activeElement.id), "view");
  await popup.keyboard.press("Tab");
  assert.equal(
    await popup.evaluate(() => document.activeElement.id),
    "category",
  );
  await popup.keyboard.press("Tab");
  assert.equal(
    await popup.evaluate(() => document.activeElement.id),
    "severity",
  );
  await popup.keyboard.press("Tab");
  assert.equal(
    await popup.evaluate(() => document.activeElement.id),
    "findings",
  );
  await popup.keyboard.press("ArrowDown");
  await popup.waitForTimeout(100);
  assert(await popup.locator("#findings").evaluate((el) => el.scrollTop > 0));
  // Use a synthetic stress label; page-derived strings still render only as text.
  await popup
    .locator("article code")
    .first()
    .evaluate((el) => {
      el.textContent = "mailto:" + "long-address".repeat(30) + "@example.test";
    });
  await popup.setViewportSize({ width: 320, height: 600 });
  const narrow = await popup.evaluate(() => ({
    app: document.querySelector("#app").getBoundingClientRect().width,
    overflow: [
      ...document.querySelectorAll("article,code,select,h1,.report-bar button"),
    ].some((el) => el.scrollWidth > el.clientWidth + 1),
  }));
  assert.equal(narrow.app, 320);
  assert.equal(narrow.overflow, false);
  assert(
    await popup
      .locator("#copy-safe")
      .evaluate(
        (el) => el.getBoundingClientRect().bottom <= window.innerHeight,
      ),
  );
  await popup.screenshot({ path: "docs/screenshots/popup-narrow.png" });
  await popup.setViewportSize({ width: 416, height: 650 });
  const zoom = await popup.evaluate(async () => {
    const tab = await chrome.tabs.getCurrent();
    await chrome.tabs.setZoom(tab.id, 2);
    return await chrome.tabs.getZoom(tab.id);
  });
  assert.equal(zoom, 2);
  await popup.waitForTimeout(200);
  const zoomLayout = await popup.evaluate(() => ({
    width: window.innerWidth,
    app: document.querySelector("#app").getBoundingClientRect().width,
    overflow: [
      ...document.querySelectorAll("article,code,select,h1,.report-bar button"),
    ].some((el) => el.scrollWidth > el.clientWidth + 1),
  }));
  assert.equal(zoomLayout.overflow, false);
  await popup.screenshot({ path: "docs/screenshots/popup-zoom-200.png" });
  const zoomFooter = await popup.evaluate(() => {
    const app = document.querySelector("#app");
    app.scrollTop = app.scrollHeight;
    return {
      scrollable: app.scrollHeight > app.clientHeight,
      allCopyActionsVisible: [
        ...document.querySelectorAll(".report-bar button"),
      ].every((button) => {
        const { top, bottom, left, right } = button.getBoundingClientRect();
        return (
          top >= 0 &&
          bottom <= window.innerHeight &&
          left >= 0 &&
          right <= window.innerWidth
        );
      }),
    };
  });
  assert(zoomFooter.scrollable && zoomFooter.allCopyActionsVisible);
  await popup.screenshot({ path: "docs/screenshots/popup-zoom-200-copy.png" });
  await popup.evaluate(async () => {
    const tab = await chrome.tabs.getCurrent();
    await chrome.tabs.setZoom(tab.id, 1);
  });
  await page.goto(new URL("noise", fixture).href);
  await page.bringToFront();
  await popup.evaluate(() => document.querySelector("#scan").click());
  await popup.waitForFunction(
    () => document.querySelector("#inspected").textContent === "367",
  );
  assert.equal(await popup.locator("article").count(), 0);
  assert.equal(await popup.locator("#warnings").textContent(), "0");
  assert.match(
    await popup.locator('#view option[value="general"]').textContent(),
    /3 groups \/ 82 elements/,
  );
  await popup.screenshot({
    path: "docs/screenshots/popup-navigation-noise.png",
  });
  await popup.locator("#view").selectOption("general");
  assert.equal(await popup.locator("article").count(), 3);
  assert.match(await popup.locator("#shown").textContent(), /82 elements/);
  await page.goto(new URL("empty", fixture).href);
  await page.bringToFront();
  await popup.evaluate(() => document.querySelector("#scan").click());
  await popup.waitForFunction(
    () => document.querySelector("#app").dataset.state === "empty",
  );
  assert.equal(await popup.locator("#inspected").textContent(), "0");
  await popup.screenshot({ path: "docs/screenshots/popup-no-findings.png" });

  // An action popup inherits Chrome's default Page zoom when it opens.
  const settings = await context.newPage();
  await settings.goto("chrome://settings/appearance");
  const defaultZoom = await settings.evaluate(async () => {
    chrome.settingsPrivate.setDefaultZoom(2);
    return new Promise((resolve) =>
      chrome.settingsPrivate.getDefaultZoom(resolve),
    );
  });
  assert.equal(defaultZoom, 2);
  await settings.close();
  await page.goto(fixture);
  await openNativePopup();
  assert.equal(await nativeZoomRatio(), nativeDefaultDpr * 2);
  await nativeKey("Tab", "Tab", 9);
  assert.equal(await nativeFocus(), "scan");
  await nativeKey(" ", "Space", 32, " ");
  await page.waitForTimeout(300);
  assert.equal(await nativeFocus(), "scan");
  const nativeZoom = await nativeEval(`({
    width: innerWidth,
    height: innerHeight,
    scrollable: document.querySelector("#app").scrollHeight > document.querySelector("#app").clientHeight,
    appBottom: document.querySelector("#app").getBoundingClientRect().bottom,
    findingsHeight: document.querySelector("#findings").clientHeight,
    cards: document.querySelectorAll("article").length,
    overflow: [...document.querySelectorAll("h1, code, select, .report-bar button")]
      .some(el => el.scrollWidth > el.clientWidth + 1)
  })`);
  assert.equal(nativeZoom.cards, contactCount);
  assert.equal(nativeZoom.overflow, false);
  assert(nativeZoom.findingsHeight >= 100);
  assert(
    nativeZoom.scrollable && nativeZoom.appBottom <= nativeZoom.height + 1,
  );
  for (const control of [
    "view",
    "category",
    "severity",
    "findings",
    ...Array(contactCount).fill("locate"),
    "copy-safe",
    "copy",
    "copy-json",
    "SUMMARY",
  ]) {
    await nativeKey("Tab", "Tab", 9);
    const focus = await nativeEval(`(() => {
      const el = document.activeElement;
      const { top, bottom, left, right } = el.getBoundingClientRect();
      return {
        control: el.id || el.className || el.tagName,
        visible: bottom > 0 && top < innerHeight && left >= 0 && right <= innerWidth
      };
    })()`);
    assert.deepEqual(focus, { control, visible: true });
  }
  await nativeKey(" ", "Space", 32, " ");
  assert(await nativeEval('document.querySelector("footer details").open'));
  await nativeKey("Tab", "Tab", 9, undefined, 8); // Shift+Tab
  assert.equal(await nativeFocus(), "copy-json");

  const output = {
    chrome: version.product,
    extensionVersion: JSON.parse(await readFile("dist/manifest.json", "utf8"))
      .version,
    fixtureElements: scanned.inspected,
    findingGroups: scanned.findings.length,
    contactGroups: contactCount,
    generalGroups: generalCount,
    dimensions: {
      nativeInitial,
      nativeScanned,
      nativeLayout,
      nativeZoom,
      narrow,
      zoomLayout,
      zoomFooter,
    },
    copyStatus,
    safeSummary: {
      clipboard: "passed",
      fallback: "passed",
      copiedText: copiedSafeSummary,
    },
    jsonExport: {
      clipboard: "passed",
      fallback: "passed",
      schemaVersion: structured.schemaVersion,
    },
    checks: [
      "unpacked extension load via Chrome CDP",
      "packaged scanner executed on synthetic DOM",
      "query redaction",
      "missing-name fixture warning, named duplicate, SVG title, hidden ARIA reference, visually hidden text and CSS-generated content deferral",
      "real popup render",
      "Copy JSON real clipboard success, separate unfiltered sections and focused selectable denial fallback",
      "Copy safe summary real clipboard success with all filters active, no identifiers, and focused selectable denial fallback",
      "unsupported-context error",
      "action activeTab grant and real scripting scan through popup controller",
      "popup cards and filtering",
      "real highlight injection and cleanup without changing fixture content",
      "native action popup dimensions, one-line title and visible report/footer",
      "native action popup keyboard activation, retained focus and accessible names",
      "native action popup at 200% default zoom with findings and all controls reachable by keyboard",
      "filter and clipboard fallback field boundary contrast",
      "keyboard focus order and findings scrolling",
      "320px viewport and long-URL overflow",
      "real Chrome 200% tab zoom",
      "contact-first view, separate general observations and scoped counts",
      "synthetic 367-element navigation-noise acceptance scenario: 0 contact groups, 3 general groups / 82 elements",
    ],
    unverified: [
      "manual toolbar popup interaction",
      "manual screen-reader and keyboard usability",
      "Chrome Web Store review",
      "other OS/Node CI jobs",
    ],
  };
  await writeFile(
    "docs/smoke-results.json",
    JSON.stringify(output, null, 2) + "\n",
  );
  console.log(JSON.stringify(output, null, 2));
} finally {
  await context?.close();
  await new Promise((r) => server.close(r));
  await rm(profile, { recursive: true, force: true });
}
