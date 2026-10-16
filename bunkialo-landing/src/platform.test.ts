import { expect, test } from "bun:test";
import { detectDevice, getFor, links } from "./platform.ts";

test("Android phones and tablets get the Play Store", () => {
  const device = detectDevice("Linux armv8l", "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36");
  expect(device).toBe("android");
  expect(getFor(device).href).toBe(links.play);
});

test("iPhones and iPads that report a Mac get the web app", () => {
  expect(detectDevice("iPhone", "Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X)")).toBe("ios");
  expect(detectDevice("MacIntel", "Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0)", 5)).toBe("ios");
  expect(getFor("ios").href).toBe(links.web);
});

test("desktops get the web app", () => {
  for (const [platform, agent] of [["Win32", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"], ["MacIntel", "Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0)"], ["Linux x86_64", "Mozilla/5.0 (X11; Linux x86_64)"]]) {
    expect(detectDevice(platform, agent)).toBe("desktop");
  }
  expect(getFor("desktop").href).toBe(links.web);
});
