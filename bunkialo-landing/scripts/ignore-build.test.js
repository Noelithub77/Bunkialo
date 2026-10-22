import { expect, test } from "bun:test";
import { shouldSkipBuild } from "./ignore-build.mjs";
const base = "a".repeat(40), head = "b".repeat(40);
const options = { base, head, repository: "Noelithub77/Bunkialo" };

test("without Git metadata, compare the deployed revision and skip native-only changes", async () => {
  expect(await shouldSkipBuild({ ...options, git: () => ({ status: 129 }), request: async () => ({ ok: true, json: async () => ({ files: [{ filename: "src/app/index.tsx" }] }) }) })).toBe(true);
});
test("landing, shared media and renamed landing files require a build", async () => {
  for (const file of [{ filename: "bunkialo-landing/src/main.ts" }, { filename: "assets/landing/hero.webp" }, { filename: "other.ts", previous_filename: "bunkialo-landing/old.ts" }]) {
    expect(await shouldSkipBuild({ ...options, git: () => ({ status: 129 }), request: async () => ({ ok: true, json: async () => ({ files: [file] }) }) })).toBe(false);
  }
});
test("missing history, API errors and truncated comparisons continue safely", async () => {
  expect(await shouldSkipBuild({ ...options, base: undefined, git: () => ({ status: 129 }) })).toBe(false);
  expect(await shouldSkipBuild({ ...options, git: () => ({ status: 129 }), request: async () => ({ ok: false }) })).toBe(false);
  expect(await shouldSkipBuild({ ...options, git: () => ({ status: 129 }), request: async () => ({ ok: true, json: async () => ({ files: Array(300).fill({ filename: "src/index.ts" }) }) }) })).toBe(false);
});
test("normal Git checkouts use repository-relative changed paths", async () => {
  expect(await shouldSkipBuild({ ...options, git: () => ({ status: 0, stdout: "src/app/index.tsx\n" }) })).toBe(true);
  expect(await shouldSkipBuild({ ...options, git: () => ({ status: 0, stdout: "assets/landing/icon.svg\n" }) })).toBe(false);
});
