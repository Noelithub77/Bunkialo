import {
  buildFeedbackSubmission,
  getFeedbackCompletionUrl,
  getFeedbackFormError,
  getFeedbackState,
  type FeedbackAnswers,
} from "@/services/feedback-form";

interface FeedbackTransport {
  get: (url: string) => Promise<string>;
  post: (url: string, body: string) => Promise<string>;
}

/** A failed POST is verified, never blindly replayed. A retry starts with a fresh form. */
export async function submitFeedbackWithTransport(
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
  if (submissionError instanceof Error) throw submissionError;
  if (state === "pending") throw new Error("Still pending on the LMS. Retry to use a fresh form.");
  throw new Error("Completion could not be verified. Check status before retrying.");
}
