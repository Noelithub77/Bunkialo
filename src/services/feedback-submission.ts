import {
  buildFeedbackSubmission,
  getFeedbackCompletionUrl,
  getFeedbackFormError,
  getFeedbackState,
  type FeedbackAnswers,
} from "@/services/feedback-form";

export class FeedbackRequestError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "FeedbackRequestError";
  }
  get retryable(): boolean {
    return this.status === undefined || [404, 408, 409, 429].includes(this.status) || this.status >= 500;
  }
}

interface FeedbackTransport {
  get: (url: string) => Promise<string>;
  post: (url: string, body: string) => Promise<string>;
}

/** A failed POST is verified, never blindly replayed. A retry starts with a fresh form. */
async function submitAttempt(
  viewUrl: string,
  answers: FeedbackAnswers,
  transport: FeedbackTransport,
): Promise<"done"> {
  const viewHtml = await transport.get(viewUrl);
  if (getFeedbackState(viewHtml) === "done") return "done";
  const completionUrl = getFeedbackCompletionUrl(viewHtml, viewUrl);
  if (!completionUrl) throw new Error("This feedback is not open");

  let pageUrl = completionUrl;
  let pageHtml = await transport.get(pageUrl);
  let submissionError: unknown;
  try {
    for (let page = 0; page < 10; page += 1) {
      const submission = buildFeedbackSubmission(pageHtml, pageUrl, answers);
      if (!submission) throw new Error("The LMS did not return an answer form");
      const responseHtml = await transport.post(submission.actionUrl, submission.body);
      const formError = getFeedbackFormError(responseHtml);
      if (formError) throw new Error(formError);
      if (submission.isFinalPage) break;
      if (page === 9) throw new Error("The feedback form has too many pages");
      pageUrl = submission.actionUrl;
      pageHtml = responseHtml;
    }
  } catch (error) {
    submissionError = error;
  }

  // A network failure can happen after the LMS saved the response.
  const state = getFeedbackState(await transport.get(viewUrl));
  if (state === "done") return "done";
  if (submissionError instanceof Error) {
    // A new POST is allowed only after the LMS explicitly reports pending.
    if (state === "pending") throw submissionError;
    throw new Error(`${submissionError.message}. Completion could not be verified; check status.`);
  }
  if (state === "pending") throw new Error("Still pending on the LMS. Retry to use a fresh form.");
  throw new Error("Completion could not be verified. Check status before retrying.");
}

export async function submitFeedbackWithTransport(
  viewUrl: string,
  answers: FeedbackAnswers,
  transport: FeedbackTransport,
  onRetry?: (attempt: number) => void,
  wait: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<"done"> {
  const delays = [1500, 3000, 6000];
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await submitAttempt(viewUrl, answers, transport);
    } catch (error) {
      const delay = delays[attempt];
      if (!(error instanceof FeedbackRequestError) || !error.retryable || delay === undefined) throw error;
      onRetry?.(attempt + 2);
      await wait(delay);
    }
  }
}
