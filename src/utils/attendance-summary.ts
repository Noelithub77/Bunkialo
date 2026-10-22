import type { AttendanceRecord, BunkRecord } from "@/types";
import { getRecordKeyVariants } from "@/utils/attendance-helpers";

export interface AttendanceSummary {
  totalSessions: number;
  attended: number;
  /** Sessions removed from the total by a portal or full-day duty leave. */
  excusedSessions: number;
  /** Unresolved "?" sessions, counted as attended. */
  unknownCount: number;
  percentage: number;
}

/**
 * Attendance over completed sessions. A duty leave only erases absences: portal
 * duty-leave sessions and non-present sessions on a duty-leave day leave the
 * total, while present sessions on that day still count.
 */
export const summarizeAttendance = (
  records: AttendanceRecord[],
  bunks: BunkRecord[],
): AttendanceSummary => {
  const bunkByKey = new Map<string, BunkRecord>();
  for (const bunk of bunks) {
    for (const key of getRecordKeyVariants(bunk)) bunkByKey.set(key, bunk);
  }

  let totalSessions = 0;
  let attended = 0;
  let excusedSessions = 0;
  let unknownCount = 0;
  for (const record of records) {
    if (record.status === "Duty Leave") {
      excusedSessions += 1;
      continue;
    }
    const bunk = getRecordKeyVariants(record)
      .map((key) => bunkByKey.get(key))
      .find((match) => match !== undefined);
    const isPresent =
      record.status === "Present" || bunk?.isMarkedPresent === true;
    if (!isPresent && bunk?.isDutyLeave) {
      excusedSessions += 1;
      continue;
    }
    totalSessions += 1;
    if (isPresent) {
      attended += 1;
    } else if (record.status === "Unknown" && !bunk) {
      unknownCount += 1;
      attended += 1;
    }
  }

  return {
    totalSessions,
    attended,
    excusedSessions,
    unknownCount,
    percentage:
      totalSessions > 0 ? Math.round((attended / totalSessions) * 100) : 0,
  };
};
