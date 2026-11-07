import type { PopupNotice } from "@/types";

const DAY_MS = 24 * 60 * 60 * 1000;

export type PopupQueueState = {
  seenPopupIds: string[];
  dismissedPopupIds: string[];
  snoozedUntil: Record<string, string>;
  firstOpenedAt: string | null;
};

export const isAnnouncement = (popup: PopupNotice): boolean => !popup.prompt;

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
  if (!state.firstOpenedAt) return null;
  const firstOpenedAt = new Date(state.firstOpenedAt).getTime();

  return (
    popups.find((popup) => {
      if (!popup.prompt || state.dismissedPopupIds.includes(popup.id)) return false;
      if (now < firstOpenedAt + popup.prompt.firstShowAfterDays * DAY_MS) return false;
      const snoozedUntil = state.snoozedUntil[popup.id];
      return !snoozedUntil || now >= new Date(snoozedUntil).getTime();
    }) ?? null
  );
}

export const getSnoozeEnd = (days: number, now: number): string =>
  new Date(now + days * DAY_MS).toISOString();
