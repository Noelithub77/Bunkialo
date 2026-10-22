import { checkSession, tryAutoLogin } from "@/services/auth/lms-auth";
import { api, getCurrentBaseUrl } from "@/services/api";
import {
  collectFeedbackLinks,
  getFeedbackState,
  getFeedbackTitle,
  type FeedbackAnswers,
  type FeedbackFormState,
} from "@/services/feedback-form";
import { isAxiosError } from "axios";
import { FeedbackRequestError, submitFeedbackWithTransport } from "@/services/feedback-submission";
import { isLoginHtml } from "@/utils/moodle-url";

export interface CourseFeedbackForm {
  url: string;
  title: string;
  state: FeedbackFormState;
}

const RETRY_DELAYS_MS = [700, 1600];

const feedbackRequestError = (error: unknown, stage: string): Error => {
  if (isAxiosError(error)) {
    const status = error.response?.status;
    return new FeedbackRequestError(status
      ? `${stage}: LMS returned ${status}. Retry with a fresh form.`
      : `${stage}: connection interrupted. Check status and retry.`, status);
  }
  return error instanceof Error ? error : new Error(`${stage} failed`);
};

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
  throw feedbackRequestError(lastError, "Loading form");
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
  onRetry?: (attempt: number) => void,
): Promise<"done"> => {
  return submitFeedbackWithTransport(viewUrl, answers, {
    get: getPage,
    post: async (url, body) => {
      try {
        const response = await api.post<string>(url, body, {
          headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Retry-After-Reauth": "true" },
        });
        if (isLoginHtml(response.data)) throw new Error("LMS session expired while submitting");
        return response.data;
      } catch (error) {
        throw feedbackRequestError(error, "Submitting answers");
      }
    },
  }, onRetry);
};
