import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { chromium, type Page } from "playwright";

const baseUrl = process.env.WEB_NOTICE_TEST_URL;
if (!baseUrl) throw new Error("Set WEB_NOTICE_TEST_URL to the web server URL.");
const outputDir = "artifacts/playwright/notice";
const releaseId = "bunkialo-v1-5-2026-10";
const allpyqId = "allpyq-launch-2026-04";
const releaseLinks = [
  "https://github.com/Noelithub77/Bunkialo/pull/34",
  "https://github.com/Noelithub77/Bunkialo/pull/32",
  "https://github.com/Noelithub77/Bunkialo/pull/35",
  "https://github.com/Noelithub77/Bunkialo/commit/75f7e6d7213fb17c1ce4d07057f5c47f61f1c048",
];

async function assertPlacement(page: Page, panelId: string, width: number, height: number) {
  const panel = page.getByTestId(panelId);
  const bounds = await panel.boundingBox();
  assert(bounds && bounds.width <= 521, `Panel must stay compact at ${width}px`);
  assert(bounds.x >= 15 && bounds.x + bounds.width <= width - 15, `Panel has page margins at ${width}px`);
  assert(bounds.y >= 0 && bounds.y + bounds.height <= height - 15, `Panel fits the viewport at ${width}x${height}`);
  if (width >= 768) {
    const bell = await page.getByRole("button", { name: "Notifications", exact: true }).boundingBox();
    assert(bell, "Dashboard bell exists");
    assert(Math.abs(bounds.y - bell.y - bell.height - 10) < 2, `Desktop panel is below the bell: ${JSON.stringify({ panelId, width, height, bounds, bell })}`);
    const expectedLeft = Math.max(16, Math.min(bell.x + bell.width - bounds.width, width - bounds.width - 16));
    assert(Math.abs(bounds.x - expectedLeft) < 2, `Desktop panel aligns to the bell with viewport margins: ${JSON.stringify({ panelId, width, height, bounds, bell })}`);
    assert.equal(bounds.width, 440);
  } else {
    assert(Math.abs(bounds.x + bounds.width / 2 - width / 2) <= 1, "Phone sheet is centered horizontally");
    assert(Math.abs(bounds.y + bounds.height - height + 16) <= 1, "Phone sheet is at the bottom");
  }
  return panel;
}

await fs.mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const notice of ["release", "allpyq"]) {
    for (const [width, height] of [[1920, 1080], [1440, 900], [768, 1024], [390, 844], [320, 568], [844, 390]]) {
      const context = await browser.newContext({ viewport: { width, height }, colorScheme: width === 768 ? "light" : "dark" });
      await context.addInitScript(({ seen }) => {
        // Keep the release inside inbox retention without replacing animation timers.
        const realNow = Date.now;
        const offset = Date.parse("2026-10-19T12:00:00+05:30") - realNow();
        Date.now = () => realNow() + offset;
        localStorage.setItem("bunkialo_lms_credentials_v1", JSON.stringify({ username: "test-student", password: "test-password" }));
        localStorage.setItem("attendance_portal_credentials_v1", JSON.stringify({ email: "test@example.edu", password: "test-password" }));
        if (!localStorage.getItem("bunkialo-popup-storage-sqlite-v1")) {
          localStorage.setItem("bunkialo-popup-storage-sqlite-v1", JSON.stringify({ state: { seenPopupIds: seen, notifiedPopupIds: seen, dismissedPopupIds: [] }, version: 0 }));
        }
      }, { seen: [notice === "release" ? allpyqId : releaseId] });
      const page = await context.newPage();
      await page.route("**/api/**", (route) => route.fulfill({ json: route.request().url().includes("/session") ? { valid: true } : [] }));
      try {
        await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
        const title = page.getByText(notice === "release" ? "Bunkialo v1.5" : "AllPYQ Is Out", { exact: true });
        await title.waitFor({ timeout: 30000 });
        await page.waitForTimeout(450);
        const panel = await assertPlacement(page, "announcement-panel", width, height);
        if (notice === "release") {
          const links = panel.getByRole("link");
          assert.equal(await links.count(), 5, "Four source references and release notes are available");
          const openedUrls: string[] = [];
          await page.exposeFunction("recordNoticeUrl", (url: string) => { openedUrls.push(url); });
          await page.evaluate(() => {
            window.open = (url) => {
              const record = Reflect.get(window, "recordNoticeUrl");
              if (typeof record === "function") record(String(url));
              return null;
            };
          });
          for (let i = 0; i < 4; i++) await links.nth(i).click();
          assert.deepEqual(openedUrls, releaseLinks, "Highlights open their verified sources");
          await links.nth(4).click();
          assert.equal(openedUrls[4], "https://github.com/Noelithub77/Bunkialo/releases/tag/v1.5.0(64)");
          if (width === 1920) {
            await page.setViewportSize({ width: 1280, height: 800 });
            await page.waitForTimeout(150);
            await assertPlacement(page, "announcement-panel", 1280, 800);
            await page.setViewportSize({ width, height });
            await page.waitForTimeout(150);
          }
        }
        await page.getByText("Got it", { exact: true }).scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${outputDir}/${notice}-${width}x${height}.png` });
        if (width === 1440 || width === 390) await panel.screenshot({ path: `${outputDir}/${notice}-${width}-card.png` });
        if (width === 1920) await page.mouse.click(8, height / 2);
        else if (width === 1440) await page.keyboard.press("Escape");
        else await page.getByText("Got it", { exact: true }).click();
        await title.waitFor({ state: "hidden" });
        await page.reload({ waitUntil: "domcontentloaded" });
        await page.locator('a[href="/mess"]').waitFor();
        await page.waitForTimeout(500);
        assert.equal(await title.count(), 0, "Seen notice does not resurface after reload");
        if (notice === "release") {
          await page.getByRole("button", { name: "Notifications", exact: true }).click();
          await page.waitForTimeout(350);
          const inbox = await assertPlacement(page, "notification-inbox-panel", width, height);
          await inbox.getByRole("button", { name: "Read: Bunkialo v1.5" }).click();
          await page.waitForTimeout(350);
          assert.equal(await inbox.getByRole("link").count(), 4, "Release references remain available in the inbox");
          if (width === 1440 || width === 390) await page.screenshot({ path: `${outputDir}/inbox-${width}.png` });
          await page.keyboard.press("Escape");
          await inbox.waitFor({ state: "hidden" });
        }
      } finally {
        await context.close();
      }
    }
  }
  console.log("Release and AllPYQ notices passed at six viewport sizes: bell alignment, bottom sheets, resize, scrolling, verified links, dismissal, persistence and inbox reopening in dark/light appearances.");
} finally {
  await browser.close();
}
