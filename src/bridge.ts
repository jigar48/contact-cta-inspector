import type { ScanResult } from "./types";
import { highlight } from "./highlight";
export function supported(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return (
      ["http:", "https:", "file:"].includes(u.protocol) &&
      u.hostname !== "chromewebstore.google.com" &&
      !(
        u.hostname === "chrome.google.com" && u.pathname.startsWith("/webstore")
      ) &&
      !/\.pdf$/i.test(u.pathname)
    );
  } catch {
    return false;
  }
}
export async function scanTab(): Promise<{
  tabId: number;
  result: ScanResult;
}> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id === undefined || !supported(tab.url))
    throw new Error(
      "This page cannot be scanned. Open a regular website. Browser pages, the Chrome Web Store and PDFs are unsupported.",
    );
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["scanner.js"],
    });
    const result = results[0]?.result as ScanResult | undefined;
    if (
      !result ||
      !Array.isArray(result.findings) ||
      typeof result.token !== "string"
    )
      throw new Error("Missing result");
    return { tabId: tab.id, result };
  } catch {
    throw new Error(
      "Chrome could not access this page. Reload a regular HTML page and retry. File pages require “Allow access to file URLs”. PDFs and protected pages are unsupported.",
    );
  }
}
export async function highlightTab(
  tabId: number,
  id: number,
  token: string,
): Promise<boolean> {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: highlight,
    args: [id, token],
  });
  return results[0]?.result === true;
}
