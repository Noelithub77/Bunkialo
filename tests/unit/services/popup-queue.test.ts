import { expect, test } from "vitest";
import {
  getDuePrompt,
  getSnoozeEnd,
  getUnseenAnnouncements,
  hasUnreadNotices,
  isNoticeListed,
  type PopupQueueState,
} from "@/services/popup-queue";
import type { PopupNotice } from "@/types";

const DAY = 24 * 60 * 60 * 1000;
const opened = Date.parse("2026-11-01T00:00:00Z");
const notice = (id: string, extra: Partial<PopupNotice> = {}): PopupNotice => ({
  id,
  title: id,
  description: id,
  timestamp: "2026-10-01T00:00:00Z",
  ...extra,
});
const star = notice("star", { prompt: { firstShowAfterDays: 1, snoozeDays: 5 } });
const state = (extra: Partial<PopupQueueState> = {}): PopupQueueState => ({
  seenPopupIds: [],
  dismissedPopupIds: [],
  snoozedUntil: {},
  firstOpenedAt: new Date(opened).toISOString(),
  ...extra,
});

test("announcements put important first, then newest, and skip prompts", () => {
  const popups = [
    notice("old"),
    notice("new", { timestamp: "2026-10-20T00:00:00Z" }),
    notice("important", { isImportant: true }),
    star,
  ];
  expect(getUnseenAnnouncements(popups, state({ seenPopupIds: ["old"] })).map((p) => p.id))
    .toEqual(["important", "new"]);
});

test("a prompt waits a day after first use", () => {
  expect(getDuePrompt([star], state(), opened + DAY - 1)).toBeNull();
  expect(getDuePrompt([star], state(), opened + DAY)?.id).toBe("star");
  expect(getDuePrompt([star], state({ firstOpenedAt: null }), opened + 9 * DAY)).toBeNull();
});

test("not now snoozes a prompt for five days; starring retires it", () => {
  const shownAt = opened + 2 * DAY;
  const snoozed = state({ snoozedUntil: { star: getSnoozeEnd(5, shownAt) } });
  expect(getDuePrompt([star], snoozed, shownAt + 5 * DAY - 1)).toBeNull();
  expect(getDuePrompt([star], snoozed, shownAt + 5 * DAY)?.id).toBe("star");
  expect(getDuePrompt([star], state({ dismissedPopupIds: ["star"] }), shownAt + 99 * DAY)).toBeNull();
});

test("users from before the cutoff skip the first-use delay", () => {
  const cutoff = new Date(opened + 10 * DAY).toISOString();
  const migrated = notice("star", {
    prompt: { firstShowAfterDays: 1, snoozeDays: 5, existingUsersBefore: cutoff },
  });
  const now = opened + 10 * DAY + 1;
  expect(getDuePrompt([migrated], state({ firstOpenedAt: new Date(opened + 9 * DAY).toISOString() }), now)?.id)
    .toBe("star");
  expect(getDuePrompt([migrated], state({ firstOpenedAt: new Date(now).toISOString() }), now)).toBeNull();
});

test("a prompt joins the inbox once due or shown, and counts as unread until seen", () => {
  expect(isNoticeListed(star, state(), opened + DAY - 1)).toBe(false);
  expect(isNoticeListed(star, state(), opened + DAY)).toBe(true);
  expect(isNoticeListed(star, state({ seenPopupIds: ["star"] }), opened)).toBe(true);
  expect(hasUnreadNotices([star], state(), opened + DAY - 1)).toBe(false);
  expect(hasUnreadNotices([star], state(), opened + DAY)).toBe(true);
  expect(hasUnreadNotices([star], state({ seenPopupIds: ["star"] }), opened + DAY)).toBe(false);
  expect(hasUnreadNotices([star], state({ dismissedPopupIds: ["star"] }), opened + DAY)).toBe(false);
});
