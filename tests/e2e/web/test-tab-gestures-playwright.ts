import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { chromium, webkit, type Page } from "playwright";

const baseUrl = process.env.WEB_GESTURE_TEST_URL;
if (!baseUrl) throw new Error("Set WEB_GESTURE_TEST_URL to a built web app URL.");
const engineName = process.env.WEB_GESTURE_ENGINE ?? "chromium";
if (engineName !== "chromium" && engineName !== "webkit") throw new Error("Unknown browser engine");
const browser = await (engineName === "webkit" ? webkit : chromium).launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, colorScheme: "dark",
});
await context.addInitScript(() => {
  const seen = ["allpyq-launch-2026-04", "bunkialo-v1-5-2026-10", "course-feedback-2026-10"];
  localStorage.setItem("bunkialo-popup-storage-sqlite-v1", JSON.stringify({ state: { seenPopupIds: seen, notifiedPopupIds: seen, dismissedPopupIds: [] }, version: 0 }));
  localStorage.setItem("bunkialo_lms_credentials_v1", JSON.stringify({ username: "test-student", password: "test-password" }));
  localStorage.setItem("attendance_portal_credentials_v1", JSON.stringify({ email: "test@example.edu", password: "test-password" }));
});
const page = await context.newPage();
const errors: string[] = [];
page.on("pageerror", (error) => errors.push(error.message));
await page.route("**/api/**", (route) => route.fulfill({
  json: route.request().url().includes("/session") ? { valid: true } : [],
}));
const cdp = engineName === "chromium" ? await context.newCDPSession(page) : null;
const outputDir = `artifacts/playwright/tab-gestures/${engineName}`;
await fs.mkdir(outputDir, { recursive: true });
const results: string[] = [];

async function swipe(x1: number, y1: number, x2: number, y2: number, duration = 180, cancel = false) {
  if (cdp) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x1, y: y1 }] });
    await page.waitForTimeout(20);
    for (let i = 1; i <= 10; i++) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x1 + (x2 - x1) * i / 10, y: y1 + (y2 - y1) * i / 10 }] });
      await page.waitForTimeout(duration / 10);
    }
    await cdp.send("Input.dispatchTouchEvent", { type: cancel ? "touchCancel" : "touchEnd", touchPoints: [] });
  } else {
    // WebKit has no CDP touch injection. Dispatch DOM touches through its responder system.
    await page.evaluate(async ({ x1: startX, y1: startY, x2: endX, y2: endY, duration: swipeMs, cancel: cancelled }) => {
      const target = document.elementFromPoint(startX, startY);
      if (!target) throw new Error("Missing touch target");
      const dispatch = (type: string, x: number, y: number) => {
        const touch = { identifier: 1, target, clientX: x, clientY: y, pageX: x, pageY: y };
        const touches = type === "touchend" || type === "touchcancel" ? [] : [touch];
        const event = new Event(type, { bubbles: true, cancelable: true });
        Object.defineProperties(event, { touches: { value: touches }, targetTouches: { value: touches }, changedTouches: { value: [touch] } });
        target.dispatchEvent(event);
      };
      dispatch("touchstart", startX, startY);
      await new Promise((resolve) => setTimeout(resolve, 20));
      for (let i = 1; i <= 10; i++) {
        dispatch("touchmove", startX + (endX - startX) * i / 10, startY + (endY - startY) * i / 10);
        await new Promise((resolve) => setTimeout(resolve, swipeMs / 10));
      }
      dispatch(cancelled ? "touchcancel" : "touchend", endX, endY);
    }, { x1, y1, x2, y2, duration, cancel });
  }
}

async function settled(path: string, title: string) {
  await page.waitForURL((url) => url.pathname === path, { timeout: 5000 });
  const heading = page.getByText(title, { exact: true }).first();
  await heading.waitFor();
  await page.waitForFunction(({ title: expectedTitle }) => {
    const titleElement = [...document.querySelectorAll("div")].find((el) => el.textContent === expectedTitle && parseFloat(getComputedStyle(el).fontSize) >= 24);
    return titleElement && Math.abs(titleElement.getBoundingClientRect().x - 28) < 1;
  }, { title }, { timeout: 5000 });
  await page.waitForTimeout(100);
}
async function navigate(path: string, title: string) {
  await page.locator(`a[href="${path}"]`).click();
  await settled(path, title);
}
async function check(name: string, action: (page: Page) => Promise<void>) {
  await action(page);
  results.push(name);
  console.log(`Passed: ${name}`);
}

try {
  await page.goto(`${baseUrl}/mess`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await settled("/mess", "Mess Menu");
  for (let round = 0; round < 3; round++) {
    await check(`Mess to Bunks and back, round ${round + 1}`, async () => {
      await swipe(340, 70, 40, 70);
      await settled("/attendance", "Attendance");
      await swipe(50, 70, 350, 70);
      await settled("/mess", "Mess Menu");
    });
  }
  await check("carousel touch stays in Mess; immediate next touch can switch tabs", async () => {
    const before = await page.getByText("Mess Menu", { exact: true }).boundingBox();
    await swipe(300, 210, 70, 210);
    assert.equal(new URL(page.url()).pathname, "/mess");
    assert.deepEqual(await page.getByText("Mess Menu", { exact: true }).boundingBox(), before);
    await swipe(340, 70, 40, 70);
    await settled("/attendance", "Attendance");
  });
  await navigate("/mess", "Mess Menu");
  await check("cancelled carousel releases the next tab swipe", async () => {
    await swipe(300, 210, 170, 210, 180, true);
    await swipe(340, 70, 40, 70);
    await settled("/attendance", "Attendance");
  });
  await navigate("/mess", "Mess Menu");
  await check("diagonal interruption settles a complete page", async () => {
    await swipe(340, 450, 150, 490, 180, true);
    await page.waitForTimeout(1000);
    const path = new URL(page.url()).pathname;
    assert(["/mess", "/attendance"].includes(path));
    await settled(path, path === "/mess" ? "Mess Menu" : "Attendance");
  });
  await navigate("/timetable", "Timetable");
  await navigate("/mess", "Mess Menu");
  await check("leave and return restores tab swiping", async () => {
    await swipe(340, 70, 40, 70);
    await settled("/attendance", "Attendance");
  });
  await page.screenshot({ path: `${outputDir}/settled-attendance.png` });
  assert.deepEqual(errors, [], "No uncaught browser errors");
  await fs.writeFile(`${outputDir}/results.json`, JSON.stringify({ baseUrl, engineName, fixture: "Synthetic credentials and mocked APIs", touch: cdp ? "CDP touch input" : "DOM touch events", results, errors }, null, 2));
} catch (error) {
  await page.screenshot({ path: `${outputDir}/failure.png` });
  throw error;
} finally {
  await context.close();
  await browser.close();
}
