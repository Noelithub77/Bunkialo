import { expect, test } from "bun:test";
import { budget, buffer } from "./bunk-math.ts";

test("empirical budget estimate uses two bunks per credit plus one", () => {
  expect(budget(1)).toBe(3);
  expect(budget(3)).toBe(7);
  expect(budget(4)).toBe(9);
});

test("buffer counts classes above the rounded-up 80% line", () => {
  expect(buffer(35, 31)).toBe(3);
  expect(buffer(36, 29)).toBe(0);
  expect(buffer(40, 30)).toBe(-2);
});
