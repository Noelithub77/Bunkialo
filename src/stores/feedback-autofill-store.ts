import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  checkCourseFeedback,
  ensureFeedbackSession,
  submitFeedback,
} from "@/services/feedback-autofill";
import { normalizeRating } from "@/services/feedback-form";
import { fetchCourses } from "@/services/lms-courses";
import { zustandStorage } from "@/stores/storage";

export type CourseFeedbackStatus =
  | "unknown"
  | "checking"
  | "pending"
  | "retrying"
  | "submitting"
  | "verifying"
  | "done"
  | "none"
  | "closed"
  | "failed";

export interface CourseFeedbackEntry {
  courseId: string;
  name: string;
  status: CourseFeedbackStatus;
  formUrls: string[];
  message: string | null;
  submittedAt: string | null;
  updatedAt: string;
}

interface CourseFeedbackDefault {
  grade: string;
  textResponse: string;
}

interface FeedbackAutofillState {
  courseDefaults: Record<string, CourseFeedbackDefault>;
  defaultGrade: string;
  defaultText: string;
  courses: Record<string, CourseFeedbackEntry>;
  courseOrder: string[];
  lastCheckedAt: string | null;
  activity: "idle" | "checking" | "submitting" | "verifying";
  error: string | null;
  setDefaults: (grade: string, text: string) => void;
  setCourseDefault: (courseId: string, grade: string, textResponse: string) => void;
  clearCourseDefault: (courseId: string) => void;
  checkAll: () => Promise<void>;
  submit: (courseIds: string[]) => Promise<{ submitted: number; failed: number }>;
  markInterrupted: () => void;
}

const CONCURRENCY = 3;
const TRANSIENT: CourseFeedbackStatus[] = ["checking", "submitting", "retrying", "verifying"];

const runPool = async <T>(items: T[], task: (item: T) => Promise<void>, concurrency = CONCURRENCY) => {
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const item = items[next];
      next += 1;
      await task(item);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, worker),
  );
};

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Something went wrong";

export const useFeedbackAutofillStore = create<FeedbackAutofillState>()(
  persist(
    (set, get) => {
      let scanGeneration = 0;
      const update = (courseId: string, patch: Partial<CourseFeedbackEntry>) =>
        set((state) => {
          const current = state.courses[courseId];
          if (!current) return state;
          return {
            courses: {
              ...state.courses,
              [courseId]: { ...current, ...patch, updatedAt: new Date().toISOString() },
            },
          };
        });

      const refreshCourse = async (courseId: string, isCurrent = () => true) => {
        update(courseId, { status: "checking" });
        try {
          const forms = await checkCourseFeedback(courseId);
          const pending = forms.filter((form) => form.state === "pending");
          const status: CourseFeedbackStatus =
            forms.length === 0
              ? "none"
              : pending.length > 0
                ? "pending"
                : forms.some((form) => form.state === "done")
                  ? "done"
                  : "closed";
          if (!isCurrent()) return;
          update(courseId, {
            status,
            formUrls: pending.map((form) => form.url),
            message: null,
          });
        } catch (error) {
          if (isCurrent()) update(courseId, { status: "failed", message: errorMessage(error) });
        }
      };

      return {
        courseDefaults: {},
        defaultGrade: "3",
        defaultText: "-",
        courses: {},
        courseOrder: [],
        lastCheckedAt: null,
        activity: "idle",
        error: null,

        // A run cut short by the app closing must be checked again, not shown as in progress.
        markInterrupted: () =>
          set((state) => ({
            courses: Object.fromEntries(
              Object.entries(state.courses).map(([id, entry]) => [
                id,
                TRANSIENT.includes(entry.status)
                  ? { ...entry, status: "unknown" as const, message: "Interrupted" }
                  : entry,
              ]),
            ),
          })),

        setDefaults: (grade, text) =>
          set({ defaultGrade: normalizeRating(grade), defaultText: text }),

        setCourseDefault: (courseId, grade, textResponse) =>
          set((state) => ({
            courseDefaults: {
              ...state.courseDefaults,
              [courseId]: { grade: normalizeRating(grade), textResponse },
            },
          })),

        clearCourseDefault: (courseId) =>
          set((state) => {
            const { [courseId]: _removed, ...rest } = state.courseDefaults;
            return { courseDefaults: rest };
          }),

        checkAll: async () => {
          if (get().activity !== "idle") return;
          const generation = ++scanGeneration;
          const isCurrent = () => generation === scanGeneration;
          set({ activity: "checking", error: null });
          try {
            await ensureFeedbackSession();
            if (!isCurrent()) return;
            const courses = await fetchCourses();
            if (!isCurrent()) return;
            const now = new Date().toISOString();
            set((state) => ({
              courseOrder: courses.map((course) => course.id),
              courses: Object.fromEntries(
                courses.map((course) => [
                  course.id,
                  state.courses[course.id]
                    ? { ...state.courses[course.id], name: course.name }
                    : {
                        courseId: course.id,
                        name: course.name,
                        status: "unknown" as const,
                        formUrls: [],
                        message: null,
                        submittedAt: null,
                        updatedAt: now,
                      },
                ]),
              ),
            }));
            await runPool(courses.map((course) => course.id), async (id) => {
              if (isCurrent()) await refreshCourse(id, isCurrent);
            });
            if (isCurrent()) set({ lastCheckedAt: new Date().toISOString() });
          } catch (error) {
            if (isCurrent()) set({ error: errorMessage(error) });
          } finally {
            if (isCurrent()) set({ activity: "idle" });
          }
        },

        submit: async (courseIds) => {
          if (get().activity !== "idle" && get().activity !== "checking") return { submitted: 0, failed: 0 };
          scanGeneration += 1;
          set((state) => ({
            activity: "submitting", error: null,
            courses: Object.fromEntries(Object.entries(state.courses).map(([id, entry]) => [
              id, entry.status === "checking" ? { ...entry, status: "unknown" as const } : entry,
            ])),
          }));
          let submitted = 0;
          let failed = 0;
          try {
            await ensureFeedbackSession();
            const attempted: string[] = [];
            await runPool([...new Set(courseIds)], async (courseId) => {
              // Failed or stale rows are re-read first so retries use fresh form links.
              if (!get().courses[courseId] || get().courses[courseId]?.status === "done") return;
              await refreshCourse(courseId);
              const entry = get().courses[courseId];
              if (entry?.status !== "pending") {
                if (entry?.status === "failed") failed += 1;
                return;
              }
              attempted.push(courseId);
              const override = get().courseDefaults[courseId];
              const answers = {
                rating: override?.grade ?? get().defaultGrade,
                text: override?.textResponse || get().defaultText,
              };
              update(courseId, { status: "submitting", message: null });
              try {
                for (const url of entry.formUrls) {
                  await submitFeedback(url, answers, (attempt) =>
                    update(courseId, { status: "retrying", message: `Attempt ${attempt} of 4` }),
                  );
                }
                update(courseId, { status: "verifying" });
              } catch (error) {
                update(courseId, { status: "failed", message: errorMessage(error) });
              }
            }, 1);

            // Final pass: trust only what the LMS reports after every submission.
            set({ activity: "verifying" });
            await runPool(attempted, async (courseId) => {
              const submitError = get().courses[courseId]?.message ?? null;
              await refreshCourse(courseId);
              const { status, message: checkError } = get().courses[courseId] ?? {};
              if (status === "done") {
                submitted += 1;
                update(courseId, { submittedAt: new Date().toISOString() });
              } else {
                failed += 1;
                update(courseId, {
                  status: "failed",
                  message: submitError ?? checkError ?? "Still pending on the LMS",
                });
              }
            });
          } catch (error) {
            set({ error: errorMessage(error) });
          } finally {
            set({ activity: "idle", lastCheckedAt: new Date().toISOString() });
          }
          return { submitted, failed };
        },
      };
    },
    {
      name: "bunkialo-feedback-autofill-storage-sqlite-v1",
      storage: createJSONStorage(() => zustandStorage),
      partialize: (state) => ({
        courseDefaults: state.courseDefaults,
        defaultGrade: state.defaultGrade,
        defaultText: state.defaultText,
        courses: state.courses,
        courseOrder: state.courseOrder,
        lastCheckedAt: state.lastCheckedAt,
      }),
      onRehydrateStorage: () => (state) => state?.markInterrupted(),
    },
  ),
);
