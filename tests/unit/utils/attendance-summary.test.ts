import { describe, expect, test } from "bun:test";
import type {
  AttendanceRecord,
  AttendanceStatus,
  BunkRecord,
  CourseBunkData,
} from "@/types";
import { summarizeAttendance } from "@/utils/attendance-summary";
import { applyDutyLeaveDays, setDutyLeaveDay } from "@/utils/duty-leave-days";

const record = (
  date: string,
  status: AttendanceStatus,
): AttendanceRecord => ({
  sessionId: date,
  termId: "term",
  date,
  exactDate: "",
  startTime: "",
  endTime: "",
  section: null,
  topic: null,
  description: "Class",
  status,
  sourceStatus: "PRESENT",
  points: "1 / 1",
});

const bunk = (date: string, patch: Partial<BunkRecord> = {}): BunkRecord => ({
  id: date,
  date,
  description: "Class",
  timeSlot: null,
  note: "",
  source: "attendancePortal",
  isDutyLeave: false,
  dutyLeaveNote: "",
  isMarkedPresent: false,
  presenceNote: "",
  ...patch,
});

const course = (courseId: string, bunks: BunkRecord[]): CourseBunkData => ({
  courseId,
  courseName: courseId,
  config: null,
  bunks,
  isConfigured: false,
  isCustomCourse: false,
  manualSlots: [],
});

describe("attendance summary", () => {
  test("leaves portal duty leaves out of the total", () => {
    // IHS312: 10 present, 1 absent and 2 duty leaves is 10 / 11.
    const records = [
      ...Array.from({ length: 10 }, (_, index) =>
        record(`Tue ${index + 1} Sep 2026 3:30PM - 4:30PM`, "Present"),
      ),
      record("Tue 22 Sep 2026 3:30PM - 4:30PM", "Absent"),
      record("Tue 4 Aug 2026 3:30PM - 4:31PM", "Duty Leave"),
      record("Tue 21 Jul 2026 3:30PM - 4:30PM", "Duty Leave"),
    ];
    const summary = summarizeAttendance(records, [
      bunk("Tue 22 Sep 2026 3:30PM - 4:30PM"),
    ]);
    expect(summary).toMatchObject({
      totalSessions: 11,
      attended: 10,
      excusedSessions: 2,
      percentage: 91,
    });
  });

  test("a duty-leave day erases absences but keeps present sessions", () => {
    const records = [
      record("Mon 5 Oct 2026 9:00AM - 10:00AM", "Present"),
      record("Mon 5 Oct 2026 11:00AM - 12:00PM", "Absent"),
      record("Mon 5 Oct 2026 2:00PM - 3:00PM", "Absent"),
      record("Tue 6 Oct 2026 9:00AM - 10:00AM", "Absent"),
    ];
    const summary = summarizeAttendance(records, [
      bunk("Mon 5 Oct 2026 11:00AM - 12:00PM", { isDutyLeave: true }),
      bunk("Mon 5 Oct 2026 2:00PM - 3:00PM", { isMarkedPresent: true }),
      bunk("Tue 6 Oct 2026 9:00AM - 10:00AM"),
    ]);
    expect(summary).toMatchObject({
      totalSessions: 3,
      attended: 2,
      excusedSessions: 1,
    });
  });

  test("unresolved unknown sessions count as attended", () => {
    const summary = summarizeAttendance(
      [record("Wed 7 Oct 2026 9:00AM - 10:00AM", "Unknown")],
      [],
    );
    expect(summary).toMatchObject({ totalSessions: 1, attended: 1, unknownCount: 1 });
  });
});

describe("full-day duty leave", () => {
  const day = "Mon 5 Oct 2026";

  test("marks every absence that day in every course, except present corrections", () => {
    const courses = setDutyLeaveDay(
      [
        course("A", [bunk(`${day} 9:00AM - 10:00AM`), bunk("Tue 6 Oct 2026 9:00AM - 10:00AM")]),
        course("B", [
          bunk(`${day} 2:00PM - 3:00PM`),
          bunk(`${day} 4:00PM - 5:00PM`, { isMarkedPresent: true }),
        ]),
      ],
      "2026-10-05",
      "Hackathon",
    );
    const flags = courses.flatMap((item) => item.bunks.map((b) => b.isDutyLeave));
    expect(flags).toEqual([true, false, true, false]);
    expect(courses[1].bunks[0].dutyLeaveNote).toBe("Hackathon");

    const cleared = setDutyLeaveDay(courses, "2026-10-05", null);
    expect(cleared.flatMap((item) => item.bunks.map((b) => b.isDutyLeave))).toEqual([
      false,
      false,
      false,
      false,
    ]);
  });

  test("extends older per-session duty leaves to their day", () => {
    const courses = applyDutyLeaveDays([
      course("A", [bunk(`${day} 9:00AM - 10:00AM`, { isDutyLeave: true, dutyLeaveNote: "Fest" })]),
      course("B", [bunk(`${day} 2:00PM - 3:00PM`)]),
    ]);
    expect(courses[1].bunks[0]).toMatchObject({ isDutyLeave: true, dutyLeaveNote: "Fest" });
  });
});
