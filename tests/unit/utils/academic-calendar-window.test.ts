import { describe, expect, test } from "vitest";
import type { AcademicEvent } from "@/types";
import { getAcademicEventsForWindow } from "@/utils/academic-calendar-window";

const event = (id: string, date: string, endDate?: string): AcademicEvent => ({
  id,
  title: id,
  date,
  endDate,
  category: "academic",
  termId: "odd-2026-27",
});

describe("academic calendar dashboard window", () => {
  test("includes events starting within the seven-day window", () => {
    const events = getAcademicEventsForWindow(
      [event("inside", "2026-09-22"), event("after", "2026-09-27")],
      "2026-09-19",
      "2026-09-25",
    );

    expect(events.map((item) => item.id)).toEqual(["inside"]);
  });

  test("includes a multi-day event that overlaps the window", () => {
    const events = getAcademicEventsForWindow(
      [event("overlap", "2026-09-18", "2026-09-20")],
      "2026-09-19",
      "2026-09-25",
    );

    expect(events.map((item) => item.id)).toEqual(["overlap"]);
  });
});
