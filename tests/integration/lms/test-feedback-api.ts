/** Read-only capability probe. Write methods omit required arguments and cannot submit. */
import { createLmsSession, loadEnvFromRoot } from "../../helpers/lms-session";

loadEnvFromRoot();
const session = createLmsSession();
if (!(await session.ensureSession())) throw new Error("Could not authenticate the test account");
const sesskey = await session.getSesskey();
const methods = [
  "get_feedbacks_by_courses", "get_feedback_access_information", "get_current_completed_tmp",
  "get_items", "get_page_items", "get_unfinished_responses", "get_finished_responses",
  "get_last_completed", "get_analysis", "get_non_respondents", "get_responses_analysis",
  "view_feedback", "launch_feedback", "process_page",
];

const field = (value: unknown, key: string): unknown =>
  typeof value === "object" && value !== null && key in value ? Reflect.get(value, key) : undefined;

for (const method of methods) {
  const name = `mod_feedback_${method}`;
  const response = await session.fetchWithSession(`/lib/ajax/service.php?sesskey=${sesskey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify([{ index: 0, methodname: name, args: {} }]),
  });
  const result: unknown = await response.json();
  const item: unknown = Array.isArray(result) ? result[0] : result;
  const error = field(field(item, "exception"), "errorcode");
  console.log(JSON.stringify({ method: name, httpStatus: response.status, result: error ?? "available" }));
}

const response = await fetch(`${session.baseUrl}/login/token.php`, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    username: process.env.LMS_TEST_USERNAME ?? "",
    password: process.env.LMS_TEST_PASSWORD ?? "",
    service: "moodle_mobile_app",
  }),
});
const result: unknown = await response.json();
console.log(JSON.stringify({
  service: "moodle_mobile_app",
  httpStatus: response.status,
  result: typeof field(result, "token") === "string" ? "available" : field(result, "errorcode") ?? "unexpected response",
}));
