package com.codialo.bunkialo.mess

import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.wear.compose.foundation.hierarchicalFocusGroup
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.PagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.wear.compose.foundation.lazy.TransformingLazyColumn
import androidx.wear.compose.foundation.lazy.rememberTransformingLazyColumnState
import androidx.wear.compose.material3.Card
import androidx.wear.compose.material3.CardDefaults
import androidx.wear.compose.material3.Icon
import androidx.wear.compose.material3.MaterialTheme
import androidx.wear.compose.material3.ScreenScaffold
import androidx.wear.compose.material3.ScrollIndicator
import androidx.wear.compose.material3.Text
import com.codialo.bunkialo.R
import com.codialo.bunkialo.schedule.Pastel
import com.codialo.bunkialo.schedule.TimetableDay
import java.time.LocalDateTime

@Composable
fun MessMenuScreen(
    pagerState: PagerState,
    now: LocalDateTime,
    menu: Map<java.time.DayOfWeek, DayMenu>,
    dayHeader: @Composable (TimetableDay) -> Unit,
) {
    HorizontalPager(
        state = pagerState,
        modifier = Modifier
            .fillMaxSize()
            .clipToBounds(),
    ) { page ->
        val day = TimetableDay.entries[page % TimetableDay.entries.size]
        Box(
            modifier = Modifier
                .fillMaxSize()
                .hierarchicalFocusGroup(active = pagerState.currentPage == page),
        ) {
            DayMessMenu(
                day = day,
                now = now,
                menu = menu,
                dayHeader = { dayHeader(day) },
            )
        }
    }
}

@Composable
private fun DayMessMenu(
    day: TimetableDay,
    now: LocalDateTime,
    menu: Map<java.time.DayOfWeek, DayMenu>,
    dayHeader: @Composable () -> Unit,
) {
    val listState = rememberTransformingLazyColumnState()
    val isToday = day.dayOfWeek == now.dayOfWeek
    val todayMenu = menu[day.dayOfWeek]
    val (currentMeal, nextMeal) = if (isToday) currentOrNextMeal(now, menu) else (null to null)

    var expandedMealType by remember { mutableStateOf<MealType?>(null) }

    val meals = todayMenu?.meals ?: emptyList()
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
                    .padding(horizontal = 4.dp),
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
            meals.forEach { meal ->
                item {
                    val isNow = isToday && meal == currentMeal
                    val isNext = isToday && meal == nextMeal && currentMeal == null
                    val isExpanded = expandedMealType == meal.type

                    MealCard(
                        meal = meal,
                        isNow = isNow,
                        isNext = isNext,
                        isExpanded = isExpanded,
                        onClick = {
                            expandedMealType = if (isExpanded) null else meal.type
                        },
                    )
                }
            }

            if (meals.isEmpty()) {
                item {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(32.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(text = "No menu available", color = Color(0xFF8A8A8A))
                    }
                }
            }
            }
        }
    }
}

@Composable
private fun MealCard(
    meal: Meal,
    isNow: Boolean,
    isNext: Boolean,
    isExpanded: Boolean,
    onClick: () -> Unit,
) {
    val colors = pastelColors(meal.type.pastel)
    val highlightBorder = when {
        isNow -> Color(0xFF83C98D)
        isNext -> Color(0xFFB49AEF)
        else -> null
    }

    Card(
        onClick = onClick,
        modifier = Modifier
            .fillMaxWidth()
            .animateContentSize(),
        colors = CardDefaults.cardColors(
            containerColor = colors.background,
            contentColor = colors.content,
            titleColor = colors.content,
            subtitleColor = colors.content,
            timeColor = colors.content,
        ),
        border = highlightBorder?.let { BorderStroke(2.dp, it) },
    ) {
        Box(modifier = Modifier.fillMaxWidth()) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 14.dp, vertical = 10.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalAlignment = Alignment.Top,
            ) {
                Box(
                    modifier = Modifier
                        .width(5.dp)
                        .height(if (isExpanded) 56.dp else 42.dp)
                        .background(colors.accent, RoundedCornerShape(50)),
                )
                Column(modifier = Modifier.weight(1f)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            text = meal.name,
                            color = Color.Black,
                            fontWeight = FontWeight.Bold,
                            style = MaterialTheme.typography.titleLarge,
                        )
                        Icon(
                            painter = painterResource(
                                if (isExpanded) R.drawable.ic_chevron_up_24 else R.drawable.ic_chevron_down_24
                            ),
                            contentDescription = if (isExpanded) "Collapse" else "Expand",
                            tint = Color.Black.copy(alpha = 0.55f),
                            modifier = Modifier.size(16.dp),
                        )
                    }

                    if (isExpanded) {
                        Text(
                            text = meal.time,
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.SemiBold,
                            color = Color.Black.copy(alpha = 0.9f),
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        Column(
                            modifier = Modifier.fillMaxWidth(),
                            verticalArrangement = Arrangement.spacedBy(3.dp),
                        ) {
                            meal.items.forEach { item ->
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                                    modifier = Modifier.fillMaxWidth(),
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .size(5.dp)
                                            .background(colors.accent, CircleShape),
                                    )
                                    Text(
                                        text = item,
                                        style = MaterialTheme.typography.bodySmall,
                                        color = Color.Black,
                                        fontWeight = FontWeight.Medium,
                                    )
                                }
                            }
                        }
                    } else {
                        Text(
                            text = meal.items.joinToString(", "),
                            style = MaterialTheme.typography.bodySmall,
                            color = Color.Black.copy(alpha = 0.8f),
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis,
                        )
                        Text(
                            text = meal.time,
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.SemiBold,
                            color = Color.Black.copy(alpha = 0.9f),
                        )
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
