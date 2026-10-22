import type { BunkRecord, CourseBunkData } from "@/types";
import { parseRecordDate } from "@/utils/attendance-helpers";

/** `yyyy-MM-dd` day of a session, used to apply duty leave to the whole day. */
export const getBunkDay = (bunk: Pick<BunkRecord, "date">): string | null => {
  const date = parseRecordDate(bunk.date);
  if (!date) return null;
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

/**
 * Duty leave covers a full day: sets or clears it on every absence that day in
 * every course. Sessions corrected to present keep their state.
 */
export const setDutyLeaveDay = (
  courses: CourseBunkData[],
  day: string,
  note: string | null,
): CourseBunkData[] =>
  courses.map((course) => ({
    ...course,
    bunks: course.bunks.map((bunk) =>
      getBunkDay(bunk) !== day || (note !== null && bunk.isMarkedPresent)
        ? bunk
        : { ...bunk, isDutyLeave: note !== null, dutyLeaveNote: note ?? "" },
    ),
  }));

/** Extends existing duty leaves, including older per-session ones, to their whole day. */
export const applyDutyLeaveDays = (
  courses: CourseBunkData[],
): CourseBunkData[] => {
  const notes = new Map<string, string>();
  for (const course of courses) {
    for (const bunk of course.bunks) {
      const day = bunk.isDutyLeave ? getBunkDay(bunk) : null;
      if (day && !notes.get(day)) notes.set(day, bunk.dutyLeaveNote);
    }
  }
  return [...notes].reduce(
    (result, [day, note]) => setDutyLeaveDay(result, day, note),
    courses,
  );
};
