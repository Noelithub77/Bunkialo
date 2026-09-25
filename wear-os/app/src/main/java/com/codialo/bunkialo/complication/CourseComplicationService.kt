package com.codialo.bunkialo.complication

import android.app.PendingIntent
import android.content.Intent
import androidx.wear.watchface.complications.data.PlainComplicationText
import androidx.wear.watchface.complications.data.ShortTextComplicationData
import androidx.wear.watchface.complications.data.ComplicationType
import androidx.wear.watchface.complications.datasource.ComplicationRequest
import androidx.wear.watchface.complications.datasource.SuspendingComplicationDataSourceService
import com.codialo.bunkialo.presentation.MainActivity
import com.codialo.bunkialo.presentation.TimetableLaunchRequest
import com.codialo.bunkialo.schedule.complicationEvent
import com.codialo.bunkialo.schedule.WearTimetableRepository
import com.codialo.bunkialo.schedule.TimetableDay
import java.time.LocalDateTime

class CourseComplicationService : SuspendingComplicationDataSourceService() {
    override suspend fun onComplicationRequest(
        request: ComplicationRequest,
    ): ShortTextComplicationData {
        val timetable = WearTimetableRepository(this).load().timetable
        val scheduledEvent = complicationEvent(LocalDateTime.now(), timetable)
        val shortLabel = scheduledEvent?.event?.shortTitle.orEmpty()
        val fullLabel = scheduledEvent?.event?.title ?: shortLabel
        val text = PlainComplicationText.Builder(shortLabel).build()
        val contentDesc = PlainComplicationText.Builder(fullLabel).build()

        return ShortTextComplicationData.Builder(
            text = text,
            contentDescription = contentDesc,
        )
            .setTapAction(openAppIntent(scheduledEvent?.day))
            .build()
    }

    override fun getPreviewData(type: ComplicationType): ShortTextComplicationData {
        val text = PlainComplicationText.Builder("DBMS").build()
        return ShortTextComplicationData.Builder(
            text = text,
            contentDescription = text,
        )
            .setTapAction(openAppIntent(null))
            .build()
    }

    private fun openAppIntent(day: TimetableDay?): PendingIntent = PendingIntent.getActivity(
        this,
        0,
        Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                Intent.FLAG_ACTIVITY_CLEAR_TOP or
                Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra(TimetableLaunchRequest.EXTRA_OPEN_TIMETABLE, true)
            day?.let { putExtra(TimetableLaunchRequest.EXTRA_TIMETABLE_DAY, it.name) }
        },
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
}
