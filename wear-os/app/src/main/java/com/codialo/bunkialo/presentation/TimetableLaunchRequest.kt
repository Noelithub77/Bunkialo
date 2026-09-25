package com.codialo.bunkialo.presentation

import android.content.Intent
import com.codialo.bunkialo.schedule.TimetableDay

data class TimetableLaunchRequest(
    val requestId: Int,
    val day: TimetableDay?,
) {
    companion object {
        const val EXTRA_OPEN_TIMETABLE = "com.codialo.bunkialo.OPEN_TIMETABLE"
        const val EXTRA_TIMETABLE_DAY = "com.codialo.bunkialo.TIMETABLE_DAY"

        fun fromIntent(intent: Intent, requestId: Int): TimetableLaunchRequest? {
            if (!intent.getBooleanExtra(EXTRA_OPEN_TIMETABLE, false)) return null

            val requestedDay = intent.getStringExtra(EXTRA_TIMETABLE_DAY)
                ?.let { dayName -> TimetableDay.entries.firstOrNull { it.name == dayName } }

            return TimetableLaunchRequest(requestId, requestedDay)
        }
    }
}
