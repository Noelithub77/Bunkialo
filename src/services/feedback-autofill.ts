import { checkSession, tryAutoLogin } from "@/services/auth/lms-auth";
import { api, getCurrentBaseUrl } from "@/services/api";
import {
  buildFeedbackSubmission,
  collectFeedbackLinks,
  getFeedbackCompletionUrl,
  getFeedbackFormError,
  getFeedbackState,
  getFeedbackTitle,
  type FeedbackAnswers,
  type FeedbackFormState,
} from "@/services/feedback-form";
import { isLoginHtml } from "@/utils/moodle-url";

export interface CourseFeedbackForm {
  url: string;
  title: string;
  state: FeedbackFormState;
}

const MAX_FORM_PAGES = 10;
const RETRY_DELAYS_MS = [700, 1600];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Only idempotent page loads are retried; a form POST is never repeated blindly.
const getPage = async (url: string): Promise<string> => {
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const response = await api.get<string>(url);
      if (isLoginHtml(response.data)) {
        throw new Error("LMS session expired");
      }
      return response.data;
    } catch (error) {
      lastError = error;
      const delay = RETRY_DELAYS_MS[attempt];
      if (delay === undefined) break;
      await ensureFeedbackSession();
      await wait(delay);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Could not load LMS page");
};

export const ensureFeedbackSession = async (): Promise<void> => {
  if ((await checkSession()) || (await tryAutoLogin())) return;
  throw new Error("Sign in to the LMS again");
};

export const checkCourseFeedback = async (
  courseId: string,
): Promise<CourseFeedbackForm[]> => {
  const baseUrl = getCurrentBaseUrl();
  const courseHtml = await getPage(`${baseUrl}/course/view.php?id=${courseId}`);
  const forms: CourseFeedbackForm[] = [];
  for (const url of collectFeedbackLinks(courseHtml, baseUrl)) {
    const viewHtml = await getPage(url);
    forms.push({
      url,
      title: getFeedbackTitle(viewHtml),
      state: getFeedbackState(viewHtml),
    });
  }
  return forms;
};

/** Fills and submits one feedback activity, then confirms the LMS marks it completed. */
export const submitFeedback = async (
  viewUrl: string,
  answers: FeedbackAnswers,
): Promise<"done"> => {
  const baseUrl = getCurrentBaseUrl();
  const viewHtml = await getPage(viewUrl);
  const completionUrl = getFeedbackCompletionUrl(viewHtml, baseUrl);
  if (!completionUrl) {
    if (getFeedbackState(viewHtml) === "done") return "done";
    throw new Error("This feedback is not open");
  }

  let pageUrl = completionUrl;
  let pageHtml = await getPage(completionUrl);
  for (let page = 0; page < MAX_FORM_PAGES; page += 1) {
    const submission = buildFeedbackSubmission(pageHtml, pageUrl, answers);
    if (!submission) break;

    const response = await api.post<string>(submission.actionUrl, submission.body, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    if (isLoginHtml(response.data)) {
      throw new Error("LMS session expired while submitting");
    }
    const next = buildFeedbackSubmission(response.data, submission.actionUrl, answers);
    if (submission.isFinalPage || !next) {
      if (next?.isFinalPage && submission.isFinalPage) {
        throw new Error(getFeedbackFormError(response.data) ?? "The LMS rejected the answers");
      }
      break;
    }
    pageUrl = submission.actionUrl;
    pageHtml = response.data;
  }

  // A completion link only disappears once Moodle has stored the response.
  if (getFeedbackState(await getPage(viewUrl)) === "pending") {
    throw new Error("The LMS still shows this feedback as pending");
  }
  return "done";
};
