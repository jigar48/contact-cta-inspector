import { chromium } from "playwright-core";
import { mkdir, writeFile } from "node:fs/promises";
import { chromePath } from "./chrome-path.mjs";
const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect width="128" height="128" rx="28" fill="#126754"/><path d="M30 32h68v48H62L43 98V80H30z" fill="none" stroke="white" stroke-width="8" stroke-linejoin="round"/><path d="m46 54 12 12 24-25" fill="none" stroke="#b6efd8" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
await mkdir("public/icons", { recursive: true });
await writeFile("public/icons/icon.svg", svg);
const browser = await chromium.launch({
  executablePath: chromePath(),
  headless: true,
});
try {
  for (const size of [16, 32, 48, 128]) {
    const page = await browser.newPage({
      viewport: { width: size, height: size },
      deviceScaleFactor: 1,
    });
    await page.setContent(
      `<style>html,body{margin:0;width:100%;height:100%;}svg{width:100%;height:100%}</style>${svg}`,
    );
    await page.screenshot({
      path: `public/icons/icon${size}.png`,
      omitBackground: true,
    });
    await page.close();
  }
} finally {
  await browser.close();
}
