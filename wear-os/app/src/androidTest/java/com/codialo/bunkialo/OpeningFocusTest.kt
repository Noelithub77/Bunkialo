package com.codialo.bunkialo

import com.codialo.bunkialo.mess.DayMenu
import com.codialo.bunkialo.mess.Meal
import com.codialo.bunkialo.mess.MealType
import com.codialo.bunkialo.mess.focusedMealForToday
import com.codialo.bunkialo.schedule.TimetableDay
import com.codialo.bunkialo.schedule.focusedEventForToday
import com.codialo.bunkialo.schedule.templateTimetable
import java.time.DayOfWeek
import java.time.LocalDateTime
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class OpeningFocusTest {
    @Test
    fun classFocusChangesAtTheExactMidpoint() {
        val events = templateTimetable.getValue(TimetableDay.WEDNESDAY)
        // The 9:30–10:25 class has its midpoint at 9:57:30.
        assertEquals(events[0], focusedEventForToday(LocalDateTime.of(2026, 10, 7, 9, 57, 29)))
        assertEquals(events[1], focusedEventForToday(LocalDateTime.of(2026, 10, 7, 9, 57, 30)))
    }

    @Test
    fun ordinaryOpeningKeepsTodayAfterTheLastClass() {
        val events = templateTimetable.getValue(TimetableDay.WEDNESDAY)
        assertEquals(events.last(), focusedEventForToday(LocalDateTime.of(2026, 10, 7, 17, 0)))
        assertEquals(events.last(), focusedEventForToday(LocalDateTime.of(2026, 10, 7, 20, 0)))
        assertNull(focusedEventForToday(LocalDateTime.of(2026, 10, 10, 10, 0)))
    }

    @Test
    fun currentMealWinsOverTheUpcomingMealIncludingOnWeekends() {
        val lunch = Meal(MealType.LUNCH, "Lunch", emptyList(), 720, 840)
        val snacks = Meal(MealType.SNACKS, "Snacks", emptyList(), 960, 1080)
        val menu = mapOf(DayOfWeek.SATURDAY to DayMenu(DayOfWeek.SATURDAY, listOf(lunch, snacks)))
        assertEquals(lunch, focusedMealForToday(LocalDateTime.of(2026, 10, 10, 13, 0), menu))
        assertEquals(snacks, focusedMealForToday(LocalDateTime.of(2026, 10, 10, 14, 0), menu))
        assertEquals(snacks, focusedMealForToday(LocalDateTime.of(2026, 10, 10, 20, 0), menu))
        assertNull(focusedMealForToday(LocalDateTime.of(2026, 10, 11, 13, 0), menu))
    }
}
