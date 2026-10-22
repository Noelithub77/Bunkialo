import type { Document, Element } from "domhandler";
import {
  getAttr,
  getText,
  parseHtml,
  querySelector,
  querySelectorAll,
} from "@/utils/html-parser";

// Pure Moodle feedback parsing shared by the app and the live LMS check.

export type FeedbackFormState = "pending" | "done" | "unavailable";

export interface FeedbackAnswers {
  /** Rating label to pick, "0" to "5". */
  rating: string;
  text: string;
}

export interface FeedbackSubmission {
  actionUrl: string;
  body: string;
  isFinalPage: boolean;
  questionsAnswered: number;
}

const FEEDBACK_VIEW_LINK = /\/mod\/feedback\/view\.php\?id=(\d+)/i;
const TEXT_INPUT_SELECTOR =
  "textarea[name], input[type='text'][name], input:not([type])[name]";

const absolute = (href: string, baseUrl: string): string => {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return href;
  }
};

const isEnabled = (node: Element): boolean =>
  getAttr(node, "disabled") === null && getAttr(node, "readonly") === null;

export const normalizeRating = (value: string): string =>
  /^[0-5]$/.test(value.trim()) ? value.trim() : "3";

/** Feedback activity links on a course page, de-duplicated by activity id. */
export const collectFeedbackLinks = (html: string, baseUrl: string): string[] => {
  const ids = new Set<string>();
  for (const link of querySelectorAll(parseHtml(html), "a[href]")) {
    const match = absolute(getAttr(link, "href") ?? "", baseUrl).match(
      FEEDBACK_VIEW_LINK,
    );
    if (match?.[1]) ids.add(match[1]);
  }
  return [...ids].map((id) => absolute(`/mod/feedback/view.php?id=${id}`, baseUrl));
};

export const getFeedbackCompletionUrl = (
  viewHtml: string,
  baseUrl: string,
): string | null => {
  const link = querySelector(
    parseHtml(viewHtml),
    "a[href*='/mod/feedback/complete.php']",
  );
  const href = link ? getAttr(link, "href") : null;
  return href ? absolute(href, baseUrl) : null;
};

export const getFeedbackState = (viewHtml: string): FeedbackFormState => {
  if (getFeedbackCompletionUrl(viewHtml, "https://lms.invalid") !== null) {
    return "pending";
  }
  const text = getText(querySelector(parseHtml(viewHtml), "[role='main']") ?? null)
    .replace(/\s+/g, " ")
    .toLowerCase();
  if (
    /already (completed|submitted|answered)|you've completed|you have completed|submitted answers|your answers have been saved/.test(
      text,
    )
  ) {
    return "done";
  }
  return "unavailable";
};

export const getFeedbackTitle = (viewHtml: string): string => {
  const doc = parseHtml(viewHtml);
  const heading = querySelector(doc, "[role='main'] h2") ?? querySelector(doc, "h1");
  return getText(heading).replace(/\s+/g, " ").trim() || "Feedback";
};

const findAnswerForm = (doc: Document): Element | null =>
  querySelectorAll(doc, "form").find(
    (form) =>
      querySelector(form, "input[name='savevalues'], input[name='gonextpage']") !==
      null,
  ) ?? null;

const labelFor = (doc: Document, input: Element): string => {
  const id = getAttr(input, "id");
  const parent = input.parent;
  const wrapping =
    parent && "tagName" in parent && parent.tagName === "label" ? parent : null;
  const label = wrapping ?? (id ? querySelector(doc, `label[for='${id}']`) : null);
  return getText(label).replace(/\s+/g, " ").trim();
};

const pickRatingOption = (
  doc: Document,
  options: Element[],
  rating: string,
): Element | undefined => {
  const labelled = options.map((option) => ({
    option,
    label: labelFor(doc, option),
  }));
  const exact = labelled.find((entry) => entry.label === rating);
  if (exact) return exact.option;

  // Pick the closest numeric label, then fall back to the middle choice.
  const target = Number(rating);
  const numeric = labelled
    .map((entry) => ({ ...entry, value: Number(entry.label) }))
    .filter((entry) => entry.label !== "" && Number.isFinite(entry.value))
    .sort((a, b) => Math.abs(a.value - target) - Math.abs(b.value - target));
  return numeric[0]?.option ?? options[Math.floor((options.length - 1) / 2)];
};

/** Builds the POST for the current page of a feedback form, or null when there is no form. */
export const buildFeedbackSubmission = (
  completeHtml: string,
  pageUrl: string,
  answers: FeedbackAnswers,
): FeedbackSubmission | null => {
  const doc = parseHtml(completeHtml);
  const form = findAnswerForm(doc);
  if (!form) return null;

  const params = new URLSearchParams();
  for (const input of querySelectorAll(form, "input[type='hidden'][name]")) {
    params.set(getAttr(input, "name") ?? "", getAttr(input, "value") ?? "");
  }

  let questionsAnswered = 0;
  const rating = normalizeRating(answers.rating);
  const radioGroups = new Map<string, Element[]>();
  for (const radio of querySelectorAll(form, "input[type='radio'][name]")) {
    if (!isEnabled(radio)) continue;
    const name = getAttr(radio, "name") ?? "";
    radioGroups.set(name, [...(radioGroups.get(name) ?? []), radio]);
  }
  for (const [name, options] of radioGroups) {
    const option = pickRatingOption(doc, options, rating);
    if (!option) continue;
    params.set(name, getAttr(option, "value") ?? "");
    questionsAnswered += 1;
  }

  const checkboxGroups = new Map<string, Element>();
  for (const checkbox of querySelectorAll(form, "input[type='checkbox'][name]")) {
    const name = getAttr(checkbox, "name") ?? "";
    if (isEnabled(checkbox) && !checkboxGroups.has(name)) {
      checkboxGroups.set(name, checkbox);
    }
  }
  for (const [name, checkbox] of checkboxGroups) {
    params.set(name, getAttr(checkbox, "value") ?? "1");
    questionsAnswered += 1;
  }

  for (const select of querySelectorAll(form, "select[name]")) {
    if (!isEnabled(select)) continue;
    const options = querySelectorAll(select, "option").filter(
      (option) => (getAttr(option, "value") ?? "").trim() !== "" && getAttr(option, "value") !== "0",
    );
    const option =
      options.find((entry) => getText(entry).trim() === rating) ?? options[0];
    if (!option) continue;
    params.set(getAttr(select, "name") ?? "", getAttr(option, "value") ?? "");
    questionsAnswered += 1;
  }

  const text = answers.text.trim() || "-";
  for (const field of querySelectorAll(form, TEXT_INPUT_SELECTOR)) {
    if (!isEnabled(field)) continue;
    const existing =
      field.tagName === "textarea" ? getText(field) : (getAttr(field, "value") ?? "");
    params.set(getAttr(field, "name") ?? "", existing.trim() || text);
    questionsAnswered += 1;
  }

  const finalButton = querySelector(form, "input[name='savevalues']");
  const button = finalButton ?? querySelector(form, "input[name='gonextpage']");
  if (button) {
    params.set(getAttr(button, "name") ?? "", getAttr(button, "value") ?? "1");
  }

  return {
    actionUrl: absolute(getAttr(form, "action") || pageUrl, pageUrl),
    body: params.toString(),
    isFinalPage: finalButton !== null,
    questionsAnswered,
  };
};

/** Moodle re-renders the form with inline errors when a required answer is rejected. */
export const getFeedbackFormError = (html: string): string | null => {
  const doc = parseHtml(html);
  const error = querySelectorAll(doc, ".invalid-feedback, .error, .alert-danger")
    .map((node) => getText(node).replace(/\s+/g, " ").trim())
    .find((message) => message.length > 0);
  return error ?? null;
};
