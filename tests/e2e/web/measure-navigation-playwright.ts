import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { chromium } from "playwright";

const baseUrl = process.env.WEB_NAV_TEST_URL;
if (!baseUrl) throw new Error("Set WEB_NAV_TEST_URL to the web server URL.");
const output = process.env.WEB_NAV_OUTPUT || "artifacts/playwright/navigation.json";
const maxSwitchMs = Number(process.env.WEB_NAV_MAX_SWITCH_MS || 300);
const width = Number(process.env.WEB_NAV_WIDTH || 1440);
const height = Number(process.env.WEB_NAV_HEIGHT || 900);
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width, height }, colorScheme: "dark" });
await context.addInitScript(() => {
  localStorage.setItem("bunkialo_lms_credentials_v1", JSON.stringify({ username: "test-student", password: "test-password" }));
  localStorage.setItem("attendance_portal_credentials_v1", JSON.stringify({ email: "test@example.edu", password: "test-password" }));
});
const page = await context.newPage();
const devtools = await context.newCDPSession(page);
await devtools.send("Performance.enable");
page.on("pageerror", (error) => console.error(error.message));
await page.route("**/api/**", (route) => route.fulfill({
  json: route.request().url().includes("/session") ? { valid: true } : [],
}));
const routes = [
  { path: "/mess", label: "Mess Menu" },
  { path: "/faculty", label: "Faculty" },
  { path: "/timetable", label: "Timetable" },
  { path: "/attendance", label: "Attendance" },
  { path: "/", label: "Dashboard" },
];
const measurements: { path: string; round: number; ms: number }[] = [];
try {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.locator('a[href="/mess"]').waitFor({ timeout: 60000 });
  await page.getByText("Got it", { exact: true }).click({ timeout: 3000 }).catch(() => undefined);
  const before = await devtools.send("Performance.getMetrics");
  const started = performance.now();
  for (let round = 0; round < 3; round += 1) {
    for (const route of routes) {
      const ms = await page.evaluate(({ path, label }) => new Promise<number>((resolve, reject) => {
        const link = [...document.querySelectorAll("a")].find((element) => element.getAttribute("href") === path);
        if (!link) return reject(new Error(`Missing navigation link: ${path}`));
        let lastX = -9999;
        let stableFrames = 0;
        const start = performance.now();
        const sample = (): void => {
          const header = [...document.querySelectorAll("div")].find((element) =>
            element.textContent === label && parseFloat(getComputedStyle(element).fontSize) >= 24,
          );
          const rect = header?.getBoundingClientRect();
          const contentLeft = innerWidth >= 960 ? 240 : 0;
          if (location.pathname === path && rect && rect.x >= contentLeft && rect.x < contentLeft + 160 && rect.y >= 0 && rect.y < 180 && header?.checkVisibility()) {
            stableFrames = Math.abs(rect.x - lastX) < 0.2 ? stableFrames + 1 : 0;
            lastX = rect.x;
            if (stableFrames >= 3) return resolve(performance.now() - start);
          } else {
            stableFrames = 0;
          }
          if (performance.now() - start > 15000) return reject(new Error(`Tab did not settle: ${path}`));
          requestAnimationFrame(sample);
        };
        link.click();
        requestAnimationFrame(sample);
      }), route);
      measurements.push({ path: route.path, round, ms: Math.round(ms) });
    }
  }
  const after = await devtools.send("Performance.getMetrics");
  const taskDuration = (metrics: typeof before): number => metrics.metrics.find((metric) => metric.name === "TaskDuration")?.value || 0;
  const mainThreadMs = Math.round((taskDuration(after) - taskDuration(before)) * 1000);
  const elapsedMs = Math.round(performance.now() - started);
  await fs.mkdir("artifacts/playwright", { recursive: true });
  await fs.writeFile(output, JSON.stringify({ baseUrl, width, height, fixture: "Synthetic credentials and mocked APIs; no live account data", mainThreadMs, elapsedMs, measurements }, null, 2));
  console.log(JSON.stringify({ mainThreadMs, elapsedMs, measurements }));
  const warm = measurements.filter((measurement) => measurement.round > 0);
  assert(warm.every((measurement) => measurement.ms <= maxSwitchMs), `Warm tab switches must settle within ${maxSwitchMs}ms`);

  await page.setViewportSize({ width: 390, height: 844 });
  await devtools.send("Emulation.setTouchEmulationEnabled", { enabled: true });
  await page.waitForTimeout(100);
  await devtools.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 55, y: 65 }] });
  for (let x = 80; x <= 355; x += 25) {
    await devtools.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: 65 }] });
    await page.waitForTimeout(16);
  }
  await devtools.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForURL("**/timetable", { timeout: 5000 });
  console.log("Touch swipe from Dashboard to Timetable passed.");
  await page.locator('a[href="/mess"]').click();
  await page.waitForURL("**/mess");
  console.log("Navigation click passed.");
} catch (error) {
  console.error(JSON.stringify({ url: page.url(), visibleText: (await page.locator("body").innerText()).slice(0, 1000) }));
  await page.screenshot({ path: "artifacts/playwright/navigation-failure.png" });
  throw error;
} finally {
  await context.close();
  await browser.close();
}
