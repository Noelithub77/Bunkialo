import { describe, expect, test } from "bun:test";
import {
  buildFeedbackSubmission,
  collectFeedbackLinks,
  getFeedbackState,
} from "@/services/feedback-form";

const BASE = "https://lms.example";

// Mirrors the LMS markup: options are listed best-first, so value 1 is labelled "5".
const ratingQuestion = (id: number) => `
  <input name="multichoice_${id}" type="hidden" value="0" id="id_multichoice_${id}" />
  ${[5, 4, 3, 2, 1, 0]
    .map(
      (label, index) => `
  <label class="form-check-label">
    <input type="radio" name="multichoice_${id}" id="id_multichoice_${id}_${index + 1}" value="${index + 1}">
    ${label}
  </label>`,
    )
    .join("")}`;

const completePage = `
  <form action="${BASE}/mod/feedback/complete.php" method="post">
    <input type="hidden" name="id" value="6294" />
    <input type="hidden" name="sesskey" value="abc" />
    ${ratingQuestion(1)}
    ${ratingQuestion(2)}
    <textarea name="textarea_3"></textarea>
    <input type="submit" name="savevalues" value="Submit your answers" />
    <input type="submit" name="cancel" value="Cancel" />
  </form>`;

describe("feedback form", () => {
  test("picks ratings by their visible label, not the option value", () => {
    const submission = buildFeedbackSubmission(completePage, BASE, {
      rating: "5",
      text: "Good",
    });
    const body = new URLSearchParams(submission?.body);
    expect(body.get("multichoice_1")).toBe("1");
    expect(body.get("multichoice_2")).toBe("1");
    expect(body.get("textarea_3")).toBe("Good");
    expect(body.get("savevalues")).toBe("Submit your answers");
    expect(body.has("cancel")).toBe(false);
    expect(body.get("sesskey")).toBe("abc");
    expect(submission?.isFinalPage).toBe(true);
    expect(submission?.questionsAnswered).toBe(3);
  });

  test("maps the lowest rating and falls back to the default", () => {
    const lowest = buildFeedbackSubmission(completePage, BASE, { rating: "0", text: "" });
    expect(new URLSearchParams(lowest?.body).get("multichoice_1")).toBe("6");
    expect(new URLSearchParams(lowest?.body).get("textarea_3")).toBe("-");
    const invalid = buildFeedbackSubmission(completePage, BASE, { rating: "9", text: "" });
    expect(new URLSearchParams(invalid?.body).get("multichoice_1")).toBe("3");
  });

  test("continues multi-page forms with the next page button", () => {
    const page = completePage.replace(
      '<input type="submit" name="savevalues" value="Submit your answers" />',
      '<input type="submit" name="gonextpage" value="Next page" />',
    );
    const submission = buildFeedbackSubmission(page, BASE, { rating: "3", text: "-" });
    expect(submission?.isFinalPage).toBe(false);
    expect(new URLSearchParams(submission?.body).get("gonextpage")).toBe("Next page");
  });

  test("reads the activity state from the view page", () => {
    expect(
      getFeedbackState(
        `<div role="main"><a href="${BASE}/mod/feedback/complete.php?id=1&courseid=2">Answer the questions</a></div>`,
      ),
    ).toBe("pending");
    expect(
      getFeedbackState(`<div role="main">You've already completed this activity.</div>`),
    ).toBe("done");
    expect(getFeedbackState(`<div role="main">This feedback is not open</div>`)).toBe(
      "unavailable",
    );
  });

  test("collects each feedback activity once", () => {
    const html = `
      <a href="/mod/feedback/view.php?id=7">Feedback</a>
      <a href="${BASE}/mod/feedback/view.php?id=7&forceview=1">Feedback</a>
      <a href="/mod/forum/view.php?id=8">Forum</a>`;
    expect(collectFeedbackLinks(html, BASE)).toEqual([
      `${BASE}/mod/feedback/view.php?id=7`,
    ]);
  });
});
