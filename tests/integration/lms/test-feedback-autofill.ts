/**
 * Live course feedback check using the app's form parser.
 *
 *   bun tests/integration/lms/test-feedback-autofill.ts                 # status of every course
 *   bun tests/integration/lms/test-feedback-autofill.ts --course-id=160 # dry run: build the answers only
 *   bun tests/integration/lms/test-feedback-autofill.ts --course-id=160 --submit [--rating=4]
 *
 * Submitting is limited to one course per run and ends with an LMS verification.
 * Required env: LMS_TEST_USERNAME, LMS_TEST_PASSWORD
 */

import {
  buildFeedbackSubmission,
  collectFeedbackLinks,
  getFeedbackCompletionUrl,
  getFeedbackFormError,
  getFeedbackState,
} from "../../../src/services/feedback-form";
import { createLmsSession, loadEnvFromRoot } from "../../helpers/lms-session";

loadEnvFromRoot();
const session = createLmsSession();
const args = process.argv.slice(2);
const arg = (name: string) =>
  args.find((value) => value.startsWith(`--${name}=`))?.split("=")[1] ?? null;
const courseId = arg("course-id");
const shouldSubmit = args.includes("--submit");
const answers = { rating: arg("rating") ?? "3", text: arg("text") ?? "-" };

const getHtml = async (url: string): Promise<string> =>
  (await session.fetchWithSession(url)).text();

const courseForms = async (id: string) => {
  const html = await getHtml(`/course/view.php?id=${id}`);
  const forms = [];
  for (const url of collectFeedbackLinks(html, session.baseUrl)) {
    forms.push({ url, state: getFeedbackState(await getHtml(url)) });
  }
  return forms;
};

const fail = (message: string): never => {
  console.error(`FAIL ${message}`);
  process.exit(1);
};

if (shouldSubmit && !courseId) fail("--submit needs --course-id");
if (!(await session.ensureSession())) fail("could not sign in to the LMS");

if (!courseId) {
  const sesskey = await session.getSesskey();
  const response = await session.fetchWithSession(
    `/lib/ajax/service.php?sesskey=${sesskey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([
        {
          index: 0,
          methodname: "core_course_get_enrolled_courses_by_timeline_classification",
          args: { offset: 0, limit: 0, classification: "inprogress", sort: "fullname" },
        },
      ]),
    },
  );
  const [result] = (await response.json()) as [
    { data: { courses: { id: number; fullname: string }[] } },
  ];
  for (const course of result.data.courses) {
    const forms = await courseForms(String(course.id));
    const states = forms.map((form) => form.state).join(", ") || "none";
    console.log(`${course.id}\t${states}\t${course.fullname}`);
  }
  process.exit(0);
}

const forms = await courseForms(courseId);
const pending = forms.filter((form) => form.state === "pending");
console.log(`course ${courseId}: ${forms.length} form(s), ${pending.length} pending`);

for (const form of pending) {
  const viewHtml = await getHtml(form.url);
  const completionUrl =
    getFeedbackCompletionUrl(viewHtml, session.baseUrl) ?? fail("no completion link");
  const pageHtml = await getHtml(completionUrl);
  const submission =
    buildFeedbackSubmission(pageHtml, completionUrl, answers) ?? fail("no answer form");
  const body = new URLSearchParams(submission.body);
  const ratings = [...body.entries()].filter(([name]) => name.startsWith("multichoice_"));
  console.log(
    `  ${form.url}\n  answers=${submission.questionsAnswered} final=${submission.isFinalPage} ` +
      `rating values=${[...new Set(ratings.map(([, value]) => value))].join(",")} ` +
      `submit=${body.has("savevalues") ? "savevalues" : "gonextpage"}`,
  );
  if (!shouldSubmit) continue;

  const response = await session.fetchWithSession(submission.actionUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: submission.body,
  });
  const responseHtml = await response.text();
  const rejected = buildFeedbackSubmission(responseHtml, submission.actionUrl, answers);
  if (rejected?.isFinalPage) {
    fail(`LMS rejected the answers: ${getFeedbackFormError(responseHtml) ?? "unknown"}`);
  }
}

if (shouldSubmit) {
  const after = await courseForms(courseId);
  const stillPending = after.filter((form) => form.state === "pending");
  console.log(`verify: ${after.map((form) => form.state).join(", ")}`);
  if (stillPending.length > 0) fail("feedback still pending after submit");
  console.log("PASS feedback submitted and verified");
} else {
  console.log("dry run only; nothing submitted");
}
