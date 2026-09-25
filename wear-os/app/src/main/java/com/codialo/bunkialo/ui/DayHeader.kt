package com.codialo.bunkialo.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import androidx.wear.compose.material3.Icon
import androidx.wear.compose.material3.MaterialTheme
import androidx.wear.compose.material3.Text
import com.codialo.bunkialo.R
import com.codialo.bunkialo.schedule.TimetableDay

@Composable
fun DayHeader(
    day: TimetableDay,
    canResetTimetable: Boolean,
    onResetTimetable: () -> Unit,
    onPreviousDay: () -> Unit,
    onNextDay: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(28.dp),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(start = 24.dp, end = 64.dp),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier = Modifier.size(28.dp).clickable(onClick = onPreviousDay),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    painter = painterResource(R.drawable.ic_chevron_left_24),
                    contentDescription = "Previous Day",
                    tint = Color(0xFF8A8A8A),
                    modifier = Modifier.size(16.dp),
                )
            }
            Box(
                modifier = Modifier.width(36.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = day.shortName,
                    style = MaterialTheme.typography.labelSmall,
                    color = Color(0xFF8A8A8A),
                )
            }
            Box(
                modifier = Modifier.size(28.dp).clickable(onClick = onNextDay),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    painter = painterResource(R.drawable.ic_chevron_right_24),
                    contentDescription = "Next Day",
                    tint = Color(0xFF8A8A8A),
                    modifier = Modifier.size(16.dp),
                )
            }
        }
        if (canResetTimetable) {
            Box(
                modifier = Modifier
                    .align(Alignment.CenterStart)
                    .padding(start = 24.dp)
                    .size(20.dp)
                    .clickable(onClick = onResetTimetable),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    painter = painterResource(R.drawable.ic_reset_24),
                    contentDescription = "Reset timetable to template",
                    tint = Color(0xFF8A8A8A),
                    modifier = Modifier.size(12.dp),
                )
            }
        }
    }
}
