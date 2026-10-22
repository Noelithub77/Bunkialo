import { expect, test } from "bun:test";
import { submitFeedbackWithTransport } from "@/services/feedback-submission";

const viewUrl = "https://lms.example/mod/feedback/view.php?id=7";
const pending = '<div role="main"><a href="/mod/feedback/complete.php?id=7">Answer</a></div>';
const done = '<div role="main">You have completed this activity.</div>';
const form = '<form action="/mod/feedback/complete.php"><input name="sesskey" type="hidden" value="fresh"><textarea name="answer"></textarea><input name="savevalues" value="Submit"></form>';
const answers = { rating: "3", text: "-" };

test("a failed response after saving is verified without repeating the POST", async () => {
  let reads = 0;
  let posts = 0;
  expect(await submitFeedbackWithTransport(viewUrl, answers, {
    get: async (url) => url === viewUrl ? (++reads === 1 ? pending : done) : form,
    post: async () => { posts++; throw new Error("Submitting answers: LMS returned 404"); },
  })).toBe("done");
  expect(posts).toBe(1);
});

test("a 404 that leaves the form pending stays retryable and a retry reloads the form", async () => {
  let posts = 0;
  let formReads = 0;
  const transport = {
    get: async (url: string) => url === viewUrl ? (posts > 1 ? done : pending) : (formReads++, form),
    post: async (_url: string, body: string) => {
      expect(new URLSearchParams(body).get("sesskey")).toBe("fresh");
      if (++posts === 1) throw new Error("Submitting answers: LMS returned 404");
      return done;
    },
  };
  await expect(submitFeedbackWithTransport(viewUrl, answers, transport)).rejects.toThrow("404");
  expect(posts).toBe(1);
  expect(await submitFeedbackWithTransport(viewUrl, answers, transport)).toBe("done");
  expect(formReads).toBe(2);
});

test("completed feedback never submits and a closed form never counts as verified", async () => {
  let posts = 0;
  expect(await submitFeedbackWithTransport(viewUrl, answers, {
    get: async () => done,
    post: async () => { posts++; return done; },
  })).toBe("done");
  expect(posts).toBe(0);
  let reads = 0;
  await expect(submitFeedbackWithTransport(viewUrl, answers, {
    get: async (url) => url === viewUrl ? (++reads === 1 ? pending : '<div role="main">Closed</div>') : form,
    post: async () => "Saved",
  })).rejects.toThrow("could not be verified");
});
