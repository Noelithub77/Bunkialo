package com.codialo.bunkialo.schedule

import java.time.LocalDateTime

fun focusedEventForToday(
    now: LocalDateTime,
    timetable: Map<TimetableDay, List<TimetableEvent>> = weeklyTimetable,
): TimetableEvent? {
    val today = TimetableDay.entries.first { it.dayOfWeek == now.dayOfWeek }
    val highlighted = complicationEvent(now, timetable)
    return if (highlighted?.day == today) highlighted.event else today.events(timetable).lastOrNull()
}

fun nextScheduledEvent(
    now: LocalDateTime,
    timetable: Map<TimetableDay, List<TimetableEvent>> = weeklyTimetable,
): ScheduledEvent? {
    val todayIndex = TimetableDay.entries.indexOfFirst { it.dayOfWeek == now.dayOfWeek }
    if (todayIndex == -1) return null

    val today = TimetableDay.entries[todayIndex]
    val nowMinutes = now.hour * 60 + now.minute
    today.events(timetable)
        .firstOrNull { it.startMinutes > nowMinutes }
        ?.let { return ScheduledEvent(today, it) }

    for (offset in 1..TimetableDay.entries.size) {
        val day = TimetableDay.entries[(todayIndex + offset) % TimetableDay.entries.size]
        day.events(timetable).firstOrNull()?.let { return ScheduledEvent(day, it) }
    }

    return null
}
