import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { chromium } from "playwright";

const baseUrl = process.env.WEB_NOTICE_TEST_URL;
if (!baseUrl) throw new Error("Set WEB_NOTICE_TEST_URL to the web server URL.");
const outputDir = "artifacts/playwright/notice";
await fs.mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const [width, height] of [[1920, 1080], [1440, 900], [768, 1024], [390, 844], [320, 568], [844, 390]]) {
    const context = await browser.newContext({ viewport: { width, height }, colorScheme: width === 768 ? "light" : "dark" });
    await context.addInitScript(() => {
      localStorage.setItem("bunkialo_lms_credentials_v1", JSON.stringify({ username: "test-student", password: "test-password" }));
      localStorage.setItem("attendance_portal_credentials_v1", JSON.stringify({ email: "test@example.edu", password: "test-password" }));
    });
    const page = await context.newPage();
    await page.route("**/api/**", (route) => route.fulfill({ json: route.request().url().includes("/session") ? { valid: true } : [] }));
    try {
      await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
      const title = page.getByText("AllPYQ Is Out", { exact: true });
      await title.waitFor({ timeout: 30000 });
      await page.waitForTimeout(400);
      const card = title.locator("..").locator("..");
      const bounds = await card.boundingBox();
      assert(bounds && bounds.width <= 521, `Notice must stay compact at ${width}px; got ${bounds?.width}px`);
      assert(bounds.x >= 15 && bounds.x + bounds.width <= width - 15, `Notice has page margins at ${width}px`);
      assert(Math.abs(bounds.x + bounds.width / 2 - width / 2) <= 1, `Notice is horizontally centered at ${width}px`);
      assert(bounds.y >= 0, `Notice heading is reachable at ${width}px`);
      if (height >= 800) assert(Math.abs(bounds.y + bounds.height / 2 - height / 2) < 2, `Notice is vertically centered at ${width}px`);
      const dismiss = page.getByText("Got it", { exact: true });
      await dismiss.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${outputDir}/${width}x${height}.png` });
      if (width === 1440 || width === 390) {
        await card.screenshot({ path: `${outputDir}/${width}-card.png` });
      }
      if (width === 1920) {
        await page.mouse.click(8, height / 2);
      } else if (width === 1440) {
        await page.keyboard.press("Escape");
      } else {
        await dismiss.click();
      }
      await title.waitFor({ state: "hidden" });
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.locator('a[href="/mess"]').waitFor();
      await page.waitForTimeout(500);
      assert.equal(await title.count(), 0, "Dismissed notice stays seen after reload");
    } finally {
      await context.close();
    }
  }
  console.log("Notice width, centering, short-screen scrolling, button/backdrop/Escape dismissal and seen-state persistence passed at six viewport sizes in dark and light appearances.");
} finally {
  await browser.close();
}
