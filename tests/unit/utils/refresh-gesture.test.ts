import { expect, test } from "bun:test";
import { getRefreshGestureDirection } from "@/utils/refresh-gesture";

test("horizontal swipes with downward drift never become refresh pulls", () => {
  for (const dx of [-120, -25, 25, 120]) {
    expect(getRefreshGestureDirection(dx, 10)).toBe("horizontal");
  }
});
test("deliberate downward pulls refresh while upward scrolling does not", () => {
  expect(getRefreshGestureDirection(4, 35)).toBe("pull");
  expect(getRefreshGestureDirection(-4, -35)).toBe("vertical");
});
test("tap jitter and ambiguous diagonal motion do not authorize refresh", () => {
  expect(getRefreshGestureDirection(3, 4)).toBe("undecided");
  expect(getRefreshGestureDirection(25, 25)).toBe("undecided");
});
