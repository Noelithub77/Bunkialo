import type { PopupNotice } from "@/types";

const DAY_MS = 24 * 60 * 60 * 1000;

export type PopupQueueState = {
  seenPopupIds: string[];
  dismissedPopupIds: string[];
  snoozedUntil: Record<string, string>;
  firstOpenedAt: string | null;
};

export const isAnnouncement = (popup: PopupNotice): boolean => !popup.prompt;

/** Whether a prompt's first-use delay is over; users from before the cutoff skip it. */
function isPromptUnlocked(
  prompt: NonNullable<PopupNotice["prompt"]>,
  firstOpenedAt: string | null,
  now: number,
): boolean {
  if (!firstOpenedAt) return false;
  const opened = new Date(firstOpenedAt).getTime();
  const cutoff = prompt.existingUsersBefore ? Date.parse(prompt.existingUsersBefore) : NaN;
  if (opened < cutoff) return true;
  return now >= opened + prompt.firstShowAfterDays * DAY_MS;
}

/** Announcements always list; a prompt lists once it is due or has been shown. */
export function isNoticeListed(
  popup: PopupNotice,
  state: Pick<PopupQueueState, "seenPopupIds" | "firstOpenedAt">,
  now = Date.now(),
): boolean {
  if (!popup.prompt) return true;
  return state.seenPopupIds.includes(popup.id) || isPromptUnlocked(popup.prompt, state.firstOpenedAt, now);
}

/** Whether any listed notice is unread, for the bell dot. */
export function hasUnreadNotices(popups: PopupNotice[], state: PopupQueueState, now = Date.now()): boolean {
  return popups.some(
    (popup) =>
      !state.seenPopupIds.includes(popup.id) &&
      !state.dismissedPopupIds.includes(popup.id) &&
      isNoticeListed(popup, state, now),
  );
}

/** Unseen announcements, most important and newest first. */
export function getUnseenAnnouncements(
  popups: PopupNotice[],
  state: Pick<PopupQueueState, "seenPopupIds" | "dismissedPopupIds">,
): PopupNotice[] {
  return popups
    .filter(
      (popup) =>
        isAnnouncement(popup) &&
        !state.seenPopupIds.includes(popup.id) &&
        !state.dismissedPopupIds.includes(popup.id),
    )
    .sort(
      (a, b) =>
        Number(Boolean(b.isImportant)) - Number(Boolean(a.isImportant)) ||
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
}

/** The first prompt that is past its first-use delay and not snoozed or retired. */
export function getDuePrompt(
  popups: PopupNotice[],
  state: PopupQueueState,
  now: number,
): PopupNotice | null {
  return (
    popups.find((popup) => {
      if (!popup.prompt || state.dismissedPopupIds.includes(popup.id)) return false;
      if (!isPromptUnlocked(popup.prompt, state.firstOpenedAt, now)) return false;
      const snoozedUntil = state.snoozedUntil[popup.id];
      return !snoozedUntil || now >= new Date(snoozedUntil).getTime();
    }) ?? null
  );
}

export const getSnoozeEnd = (days: number, now: number): string =>
  new Date(now + days * DAY_MS).toISOString();
