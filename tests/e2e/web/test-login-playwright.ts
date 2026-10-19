import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { chromium } from "playwright";

const baseUrl = process.env.WEB_LOGIN_TEST_URL;
if (!baseUrl) {
  throw new Error("Set WEB_LOGIN_TEST_URL to the local web server URL.");
}
const outputDir = "artifacts/playwright/login";
await fs.mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ colorScheme: "dark" });
const page = await context.newPage();
let loginRequests = 0;
let releaseLogin: (() => void) | undefined;
let succeed = false;
let portalRequests = 0;
const waitForLogin = async (count: number): Promise<void> => {
  for (let attempt = 0; attempt < 100 && loginRequests < count; attempt += 1) {
    await page.waitForTimeout(20);
  }
  assert.equal(loginRequests, count, "Expected the mock login request");
};

await page.route("**/api/**", async (route) => {
  if (route.request().url().endsWith("/api/auth/lms/login")) {
    loginRequests += 1;
    await new Promise<void>((resolve) => { releaseLogin = resolve; });
    await route.fulfill({ json: { success: succeed }, status: succeed ? 200 : 401 });
    return;
  }
  if (route.request().url().endsWith("/api/attendance/auth")) {
    portalRequests += 1;
    await route.fulfill({ json: { needs2fa: true, intermediate: "test-challenge" } });
    return;
  }
  await route.fulfill({ json: { valid: false }, status: 401 });
});

try {
  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
  const heading = page.getByRole("heading", { name: "Welcome to Bunkialo" });
  await heading.waitFor({ timeout: 60000 });
  const form = page.getByRole("form", { name: "Sign in" });
  const intro = page.getByRole("heading", { level: 1 });
  const submit = page.getByRole("button", { name: "Continue" });
  for (const [width, height] of [[1440, 900], [1024, 768], [768, 1024], [390, 844], [320, 568], [844, 390]]) {
    await page.setViewportSize({ width, height });
    assert.equal(await intro.isVisible(), width >= 1024, `Intro visibility at ${width}`);
    assert(await submit.isDisabled(), "Empty credentials cannot be submitted");
    const dimensions = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
    assert(dimensions.scrollWidth <= dimensions.width, `No horizontal overflow at ${width}`);
    const card = await page.getByRole("list", { name: "Account setup progress" }).locator("..").boundingBox();
    assert(card && card.x >= 20 && card.x + card.width <= width - 20, `Card has page margins at ${width}`);
    assert(card.y >= 24, `Card has top spacing at ${width}`);
    const bounds = await form.boundingBox();
    assert(bounds && bounds.x >= 0 && bounds.x + bounds.width <= width, `Form fits at ${width}`);
    if (width >= 1024) {
      const introBounds = await intro.boundingBox();
      assert(introBounds && introBounds.x + introBounds.width < bounds.x, "Desktop layout has two columns");
    }
    await page.screenshot({ path: `${outputDir}/${width}x${height}.png` });
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel("Roll number", { exact: true }).fill("test-student");
  await page.getByLabel("Password", { exact: true }).fill("test-password");
  await page.getByLabel("Show password", { exact: true }).click();
  assert.equal(await page.getByLabel("Password", { exact: true }).getAttribute("type"), "text");
  await page.getByLabel("Hide password", { exact: true }).click();
  assert.equal(await page.getByLabel("Password", { exact: true }).getAttribute("type"), "password");
  await submit.click();
  const connecting = page.getByRole("button", { name: "Connecting…" });
  await connecting.waitFor();
  assert(await connecting.isDisabled(), "Loading button is disabled");
  await page.getByLabel("Password", { exact: true }).press("Enter");
  assert.equal(loginRequests, 1, "Enter cannot duplicate a pending submission");
  await page.screenshot({ path: `${outputDir}/connecting.png` });
  await waitForLogin(1);
  releaseLogin?.();
  await page.getByRole("alert").waitFor();
  await submit.waitFor();
  await page.screenshot({ path: `${outputDir}/error.png` });
  succeed = true;
  await page.getByLabel("Password", { exact: true }).press("Enter");
  await connecting.waitFor();
  await waitForLogin(2);
  releaseLogin?.();
  await page.getByRole("heading", { name: "Connect attendance" }).waitFor();
  await page.screenshot({ path: `${outputDir}/attendance.png` });
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await heading.waitFor();
  await submit.click();
  await connecting.waitFor();
  // The mock deliberately holds the request to check the loading state.
  await waitForLogin(3);
  releaseLogin?.();
  await page.getByRole("heading", { name: "Connect attendance" }).waitFor();
  await page.getByLabel("Institute email", { exact: true }).fill("test@example.edu");
  await page.getByLabel("Password", { exact: true }).fill("test-password");
  await page.getByRole("button", { name: "Finish sign in" }).click();
  await page.getByText("Enter your code", { exact: true }).waitFor();
  await page.screenshot({ path: `${outputDir}/verification.png` });
  await page.getByRole("button", { name: "Use a backup code" }).click();
  await page.getByLabel("Backup code", { exact: true }).fill("test-backup-code");
  await page.getByLabel("Backup code", { exact: true }).press("Enter");
  for (let attempt = 0; attempt < 100 && portalRequests < 2; attempt += 1) {
    await page.waitForTimeout(20);
  }
  assert.equal(portalRequests, 2, "Verification supports Enter submission");
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.getByText("Enter your code", { exact: true }).waitFor();
  await page.screenshot({ path: `${outputDir}/verification-light-appearance.png` });
  console.log("Login layouts, password visibility, loading guard, error, Enter submission, attendance and verification passed with mocked auth.");
} finally {
  releaseLogin?.();
  await context.close();
  await browser.close();
}
