package com.codialo.bunkialo.presentation

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.KeyEvent
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.ui.draw.clipToBounds
import androidx.wear.compose.foundation.hierarchicalFocusGroup
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Composable
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.res.painterResource
import androidx.wear.remote.interactions.RemoteActivityHelper
import androidx.wear.compose.foundation.lazy.TransformingLazyColumn
import androidx.wear.compose.foundation.lazy.TransformingLazyColumnState
import androidx.wear.compose.material3.AppScaffold
import androidx.wear.compose.material3.Card
import androidx.wear.compose.material3.CardDefaults
import androidx.wear.compose.material3.MaterialTheme
import androidx.wear.compose.material3.ScreenScaffold
import androidx.wear.compose.material3.ScrollIndicator
import androidx.wear.compose.material3.Text
import com.codialo.bunkialo.presentation.theme.BunkialoTheme
import com.codialo.bunkialo.R
import com.codialo.bunkialo.schedule.Pastel
import com.codialo.bunkialo.schedule.TimetableDay
import com.codialo.bunkialo.schedule.TimetableEvent
import com.codialo.bunkialo.schedule.WearTimetableData
import com.codialo.bunkialo.schedule.WearTimetableRepository
import com.codialo.bunkialo.schedule.WearTimetableSource
import com.codialo.bunkialo.schedule.breakLabelBetween
import com.codialo.bunkialo.schedule.events
import com.codialo.bunkialo.schedule.focusedEventForToday
import com.codialo.bunkialo.schedule.nextScheduledEvent
import com.codialo.bunkialo.ui.ScreenModeToggle
import com.codialo.bunkialo.ui.DayHeader
import java.time.LocalDateTime
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import androidx.compose.ui.text.style.TextAlign
import java.util.concurrent.Executors

private val remoteActivityExecutor = Executors.newSingleThreadExecutor()

class MainActivity : ComponentActivity() {
    private val timetableLaunchRequest = mutableStateOf<TimetableLaunchRequest?>(null)
    private var timetableLaunchRequestId = 0
    private val openingId = mutableStateOf(0)
    private val modeToggleId = mutableStateOf(0)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        recordTimetableLaunchRequest(intent)
        setContent {
            key(openingId.value) {
                TimetableApp(timetableLaunchRequest.value, modeToggleId.value)
            }
        }
    }

    override fun onStart() {
        super.onStart()
        openingId.value += 1
    }

    override fun onStop() {
        super.onStop()
        // A complication target applies only to the opening that received it.
        timetableLaunchRequest.value = null
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        recordTimetableLaunchRequest(intent)
        openingId.value += 1
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_STEM_1) return true
        return super.onKeyDown(keyCode, event)
    }

    override fun onKeyUp(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_STEM_1) {
            if (event?.isCanceled == false) modeToggleId.value += 1
            return true
        }
        return super.onKeyUp(keyCode, event)
    }

    private fun recordTimetableLaunchRequest(intent: Intent) {
        val nextRequestId = timetableLaunchRequestId + 1
        timetableLaunchRequestId = nextRequestId
        timetableLaunchRequest.value = TimetableLaunchRequest.fromIntent(intent, nextRequestId)
    }
}

@Composable
private fun TimetableApp(launchRequest: TimetableLaunchRequest?, modeToggleId: Int) {
    BunkialoTheme {
        AppScaffold {
            val now = remember { mutableStateOf(LocalDateTime.now()) }
            val context = LocalContext.current
            val repository = remember { WearTimetableRepository(context) }
            val timetable = remember { mutableStateOf(repository.load()) }
            val initialDay = remember(launchRequest?.requestId) {
                launchRequest?.day?.ordinal
                    ?: TimetableDay.entries.indexOfFirst { it.dayOfWeek == now.value.dayOfWeek }
            }
            val initiallyShowMess = remember(launchRequest?.requestId) {
                val day = TimetableDay.entries[initialDay]
                launchRequest == null &&
                    (day == TimetableDay.SATURDAY || day == TimetableDay.SUNDAY) &&
                    day.events(timetable.value.timetable).isEmpty()
            }
            var isMessSelected by remember(launchRequest?.requestId) { mutableStateOf(initiallyShowMess) }
            var handledModeToggleId by remember { mutableStateOf(modeToggleId) }
            LaunchedEffect(modeToggleId) {
                if (modeToggleId != handledModeToggleId) {
                    isMessSelected = !isMessSelected
                    handledModeToggleId = modeToggleId
                }
            }
            LaunchedEffect(Unit) {
                while (true) {
                    delay(30_000)
                    now.value = LocalDateTime.now()
                    timetable.value = repository.load()
                }
            }
            val middlePage = Int.MAX_VALUE / 2
            val firstPage = middlePage - (middlePage % TimetableDay.entries.size) + initialDay
            val pagerState = rememberPagerState(
                initialPage = firstPage,
                pageCount = { Int.MAX_VALUE },
            )
            val messPagerState = rememberPagerState(
                initialPage = firstPage,
                pageCount = { Int.MAX_VALUE },
            )
            val activePagerState = if (isMessSelected) messPagerState else pagerState
            val messRepository = remember { com.codialo.bunkialo.mess.MessMenuRepository(context) }
            val messMenu = remember { messRepository.loadMenu() }
            val coroutineScope = androidx.compose.runtime.rememberCoroutineScope()
            var previousMessSelected by remember { mutableStateOf(initiallyShowMess) }

            LaunchedEffect(isMessSelected) {
                if (isMessSelected == previousMessSelected) return@LaunchedEffect
                previousMessSelected = isMessSelected
                if (isMessSelected) {
                    val messDayIndex = messPagerState.currentPage % TimetableDay.entries.size
                    val timetableDay = TimetableDay.entries[
                        pagerState.currentPage % TimetableDay.entries.size
                    ]
                    val today = TimetableDay.entries.firstOrNull { it.dayOfWeek == now.value.dayOfWeek }
                    val complicationOpenedTomorrow =
                        launchRequest?.startMinutes != null &&
                            launchRequest.day == timetableDay &&
                            timetableDay != today
                    val targetDay = if (timetableDay == today || complicationOpenedTomorrow) {
                        today ?: timetableDay
                    } else {
                        timetableDay
                    }
                    val targetPage = messPagerState.currentPage - messDayIndex + targetDay.ordinal
                    if (messPagerState.currentPage != targetPage) {
                        messPagerState.animateScrollToPage(targetPage)
                    }
                } else {
                    val timetableDayIndex = pagerState.currentPage % TimetableDay.entries.size
                    val messDay = TimetableDay.entries[
                        messPagerState.currentPage % TimetableDay.entries.size
                    ]
                    val targetPage = pagerState.currentPage - timetableDayIndex + messDay.ordinal
                    if (pagerState.currentPage != targetPage) {
                        pagerState.animateScrollToPage(targetPage)
                    }
                }
            }

            LaunchedEffect(launchRequest?.requestId) {
                val requestedDay = launchRequest?.day ?: TimetableDay.entries[initialDay]
                val pageCount = TimetableDay.entries.size
                val timetablePage = pagerState.currentPage - pagerState.currentPage % pageCount + requestedDay.ordinal
                val messPage = messPagerState.currentPage - messPagerState.currentPage % pageCount + requestedDay.ordinal
                isMessSelected = initiallyShowMess
                if (messPagerState.currentPage != messPage) messPagerState.scrollToPage(messPage)
                if (pagerState.currentPage != timetablePage) pagerState.scrollToPage(timetablePage)
            }

            BackHandler(enabled = isMessSelected) {
                isMessSelected = false
            }

            Box(modifier = Modifier.fillMaxSize()) {
                if (isMessSelected) {
                    com.codialo.bunkialo.mess.MessMenuScreen(
                        pagerState = messPagerState,
                        now = now.value,
                        menu = messMenu,
                        dayHeader = { day ->
                            DayHeader(
                                day = day,
                                canResetTimetable = false,
                                onResetTimetable = {},
                                onPreviousDay = {
                                    coroutineScope.launch {
                                        activePagerState.animateScrollToPage(activePagerState.currentPage - 1)
                                    }
                                },
                                onNextDay = {
                                    coroutineScope.launch {
                                        activePagerState.animateScrollToPage(activePagerState.currentPage + 1)
                                    }
                                },
                            )
                        },
                    )
                } else {
                    HorizontalPager(
                        state = pagerState,
                        modifier = Modifier
                            .fillMaxSize()
                            .clipToBounds(),
                    ) { page ->
                        val isCurrentTimetablePage = pagerState.currentPage == page
                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                                .hierarchicalFocusGroup(active = isCurrentTimetablePage),
                        ) {
                            DaySchedule(
                                day = TimetableDay.entries[page % TimetableDay.entries.size],
                                now = now.value,
                                timetable = timetable.value,
                                launchRequest = launchRequest,
                                dayHeader = {
                                    DayHeader(
                                        day = TimetableDay.entries[page % TimetableDay.entries.size],
                                        canResetTimetable = timetable.value.source != WearTimetableSource.TEMPLATE,
                                        onResetTimetable = { timetable.value = repository.resetToTemplate() },
                                        onPreviousDay = {
                                            coroutineScope.launch {
                                                pagerState.animateScrollToPage(pagerState.currentPage - 1)
                                            }
                                        },
                                        onNextDay = {
                                            coroutineScope.launch {
                                                pagerState.animateScrollToPage(pagerState.currentPage + 1)
                                            }
                                        },
                                    )
                                },
                            )
                        }
                    }
                }

                ScreenModeToggle(
                    isMessSelected = isMessSelected,
                    onToggle = { isMessSelected = !isMessSelected },
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(top = 36.dp, end = 40.dp),
                )
            }
        }
    }
}

private fun openTimetableEditorOnPhone(context: Context) {
    val intent = Intent(
        Intent.ACTION_VIEW,
        Uri.parse("bunkialo://timetable?wear=1"),
    ).addCategory(Intent.CATEGORY_BROWSABLE)

    RemoteActivityHelper(context, remoteActivityExecutor)
        .startRemoteActivity(intent, null)
}

@Composable
private fun DaySchedule(
    day: TimetableDay,
    now: LocalDateTime,
    timetable: WearTimetableData,
    launchRequest: TimetableLaunchRequest?,
    dayHeader: @Composable () -> Unit,
) {
    val context = LocalContext.current
    val events = day.events(timetable.timetable)
    val isToday = day.dayOfWeek == now.dayOfWeek
    val currentEventIndex = events.indexOfFirst { it.isHappeningAt(now) }
    val focusEventIndex = if (isToday) events.indexOf(focusedEventForToday(now, timetable.timetable)) else -1
    val nextPeriod = nextScheduledEvent(now, timetable.timetable)
    val requestedEventIndex = if (launchRequest?.day == day) {
        launchRequest.startMinutes?.let { startMinutes ->
            events.indexOfFirst { it.startMinutes == startMinutes }
        } ?: -1
    } else {
        -1
    }
    val initialEventIndex = remember(day, launchRequest?.requestId) {
        when {
            requestedEventIndex >= 0 -> requestedEventIndex
            focusEventIndex >= 0 -> focusEventIndex
            currentEventIndex >= 0 -> currentEventIndex
            isToday -> events.lastIndex
            nextPeriod?.day == day -> events.indexOf(nextPeriod.event)
            else -> if (events.isEmpty()) -1 else 0
        }
    }
    val initialListIndex = remember(day, launchRequest?.requestId) {
        lazyListIndexForEvent(events, initialEventIndex)
    }
    val listState = remember(day, launchRequest?.requestId) {
        TransformingLazyColumnState(initialAnchorItemIndex = initialListIndex)
    }

    ScreenScaffold(
        scrollState = listState,
        scrollIndicator = {
            ScrollIndicator(
                state = listState,
                modifier = Modifier
                    .align(Alignment.CenterEnd)
                    .padding(end = 12.dp),
            )
        },
    ) { contentPadding ->
        Box(modifier = Modifier.fillMaxSize()) {
            TransformingLazyColumn(
                state = listState,
                contentPadding = contentPadding,
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 20.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 8.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    dayHeader()
                }
            }
            if (events.isEmpty()) {
                item {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 32.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            text = if (isToday) "No classes scheduled today" else "No classes scheduled",
                            style = MaterialTheme.typography.bodyMedium,
                            color = Color(0xFF8A8A8A),
                            textAlign = TextAlign.Center,
                        )
                    }
                }
            }
            events.forEachIndexed { index, event ->
                if (index > 0) {
                    breakLabelBetween(events[index - 1], event)?.let { label ->
                        item {
                            BreakLabel(label)
                        }
                    }
                }
                item {
                    TimetableCard(
                        event = event,
                        highlight = when {
                            isToday && index == currentEventIndex -> EventHighlight.NOW
                            nextPeriod?.day == day && nextPeriod.event == event -> EventHighlight.NEXT
                            else -> EventHighlight.NONE
                        },
                    )
                }
            }
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 2.dp, end = 8.dp),
                    contentAlignment = Alignment.CenterEnd,
                ) {
                    Box(
                        modifier = Modifier
                            .size(24.dp)
                            .clickable { openTimetableEditorOnPhone(context) },
                        contentAlignment = Alignment.Center,
                    ) {
                        androidx.wear.compose.material3.Icon(
                            painter = painterResource(R.drawable.ic_edit_24),
                            contentDescription = "Edit timetable on phone",
                            tint = Color(0xFF8A8A8A),
                            modifier = Modifier.size(12.dp),
                        )
                    }
                }
            }
            }
        }
    }
}

private fun lazyListIndexForEvent(
    events: List<TimetableEvent>,
    eventIndex: Int,
): Int {
    if (eventIndex < 0) return 0

    val breakCount = (1..eventIndex).count { index ->
        breakLabelBetween(events[index - 1], events[index]) != null
    }
    return 1 + eventIndex + breakCount
}

@Composable
private fun BreakLabel(label: String) {
    Text(
        text = label,
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 1.dp),
        color = Color(0xFF8A8A8A),
        textAlign = TextAlign.Center,
        style = MaterialTheme.typography.labelSmall,
    )
}

private enum class EventHighlight {
    NOW,
    NEXT,
    NONE,
}

@Composable
private fun TimetableCard(event: TimetableEvent, highlight: EventHighlight) {
    val colors = pastelColors(event.course.pastel)
    val highlightBorder = when (highlight) {
        EventHighlight.NOW -> Color(0xFF83C98D)
        EventHighlight.NEXT -> Color(0xFFB49AEF)
        EventHighlight.NONE -> null
    }
    Card(
        onClick = {},
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = colors.background,
            contentColor = colors.content,
            titleColor = colors.content,
            subtitleColor = colors.content,
            timeColor = colors.content,
        ),
        border = highlightBorder?.let { BorderStroke(2.dp, it) },
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier = Modifier
                    .width(5.dp)
                    .height(42.dp)
                    .background(colors.accent, RoundedCornerShape(50)),
            )
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = event.course.label,
                    color = Color.Black,
                    fontWeight = FontWeight.Bold,
                    style = MaterialTheme.typography.titleLarge,
                )
                if (event.course.faculty.isNotBlank()) {
                    Text(
                        text = event.course.faculty,
                        style = MaterialTheme.typography.bodySmall,
                        maxLines = 2,
                    )
                }
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    Text(
                        text = event.time,
                        style = MaterialTheme.typography.labelMedium,
                    )
                    if (event.isLab) {
                        Box(
                            modifier = Modifier
                                .background(
                                    color = Color.Black.copy(alpha = 0.14f),
                                    shape = CircleShape,
                                )
                                .padding(horizontal = 6.dp, vertical = 2.dp),
                        ) {
                            Text(
                                text = "L",
                                color = Color.Black,
                                fontWeight = FontWeight.Bold,
                                style = MaterialTheme.typography.labelSmall,
                            )
                        }
                    }
                }
            }
        }
    }
}

private data class PastelColors(
    val background: Color,
    val content: Color,
    val accent: Color,
)

private const val CARD_ALPHA = 0.88f

private fun pastelColor(color: Color): Color = color.copy(alpha = CARD_ALPHA)

private fun pastelColors(pastel: Pastel): PastelColors = when (pastel) {
    Pastel.ROSE -> PastelColors(pastelColor(Color(0xFFF6CDD5)), Color.Black, Color(0xFF9B4F65))
    Pastel.LAVENDER -> PastelColors(pastelColor(Color(0xFFE1D4FA)), Color.Black, Color(0xFF68439E))
    Pastel.MINT -> PastelColors(pastelColor(Color(0xFFD3EDD9)), Color.Black, Color(0xFF367653))
    Pastel.BLUE -> PastelColors(pastelColor(Color(0xFFD0E8F7)), Color.Black, Color(0xFF326B92))
    Pastel.PEACH -> PastelColors(pastelColor(Color(0xFFF8D9BF)), Color.Black, Color(0xFFA65A28))
    Pastel.YELLOW -> PastelColors(pastelColor(Color(0xFFF7E7AD)), Color.Black, Color(0xFF866B13))
    Pastel.LILAC -> PastelColors(pastelColor(Color(0xFFE6D4F4)), Color.Black, Color(0xFF7B469C))
    Pastel.AQUA -> PastelColors(pastelColor(Color(0xFFCDEBE4)), Color.Black, Color(0xFF2D7165))
}
