import { existsSync } from "node:fs";
import { join } from "node:path";
/** System installation candidates only; caller can override with CHROME_PATH. */
export function chromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const candidates =
    process.platform === "win32"
      ? [
          join(
            process.env.PROGRAMFILES ?? "",
            "Google",
            "Chrome",
            "Application",
            "chrome.exe",
          ),
          join(
            process.env.LOCALAPPDATA ?? "",
            "Google",
            "Chrome",
            "Application",
            "chrome.exe",
          ),
        ]
      : process.platform === "darwin"
        ? ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"]
        : [
            "/usr/bin/google-chrome",
            "/usr/bin/google-chrome-stable",
            "/usr/bin/chromium",
            "/usr/bin/chromium-browser",
          ];
  const path = candidates.find(existsSync);
  if (!path)
    throw new Error(
      "Chrome/Chromium not found. Set CHROME_PATH to a local browser executable.",
    );
  return path;
}
