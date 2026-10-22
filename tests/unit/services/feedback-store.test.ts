import { expect, mock, test } from "bun:test";
import type { CourseFeedbackForm } from "@/services/feedback-autofill";

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
};
const firstCheck = deferred<CourseFeedbackForm[]>();
const checking = deferred<void>();
const posting = deferred<void>();
const finishPost = deferred<void>();
let completed = false;
const forms: CourseFeedbackForm[] = [{ url: "https://lms.example/mod/feedback/view.php?id=2", title: "Feedback", state: "pending" }];
mock.module("@/services/feedback-autofill", () => ({
  ensureFeedbackSession: async () => {},
  checkCourseFeedback: async (id: string) => {
    if (id === "1") { checking.resolve(); return firstCheck.promise; }
    return completed ? [{ ...forms[0], state: "done" }] : forms;
  },
  submitFeedback: async () => { posting.resolve(); await finishPost.promise; completed = true; return "done"; },
}));
mock.module("@/services/lms-courses", () => ({
  fetchCourses: async () => [{ id: "1", name: "First" }, { id: "2", name: "Second" }],
}));
mock.module("@/stores/storage", () => ({
  zustandStorage: { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} },
}));
const { useFeedbackAutofillStore } = await import("@/stores/feedback-autofill-store");

test("submission interrupts a slow scan without stale checks overwriting progress", async () => {
  const store = useFeedbackAutofillStore;
  const scan = store.getState().checkAll();
  await checking.promise;
  expect(store.getState().activity).toBe("checking");
  const submission = store.getState().submit(["2"]);
  await posting.promise;
  expect(store.getState().courses["1"].status).toBe("unknown");
  firstCheck.resolve(forms);
  await scan;
  expect(store.getState().activity).toBe("submitting");
  expect(store.getState().courses["2"].status).toBe("submitting");
  finishPost.resolve();
  expect(await submission).toEqual({ submitted: 1, failed: 0 });
  expect(store.getState().courses["2"].status).toBe("done");
  expect(store.getState().activity).toBe("idle");
});
