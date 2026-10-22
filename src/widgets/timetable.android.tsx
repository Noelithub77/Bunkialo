/** @jsxImportSource react */
import {
  Box,
  Column,
  Row,
  Text,
  TextButton,
} from "@expo/ui/jetpack-compose";
import {
  background,
  cornerRadius,
  fillMaxSize,
  fillMaxWidth,
  paddingAll,
  padding,
  width,
  semantics,
  size,
} from "@expo/ui/jetpack-compose/modifiers";
import { createWidget, type WidgetEnvironment } from "expo-widgets";
import type { ScheduleWidgetProps } from "@/types";

export const WidgetLayout = (
  props: ScheduleWidgetProps,
  environment: WidgetEnvironment & { width?: number; height?: number },
) => {
  "widget";
  const now = environment.date?.getTime() ?? Date.now();
  const local = new Date(now + props.utcOffsetMinutes * 60000);
  const midnight =
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) -
    props.utcOffsetMinutes * 60000;
  const windows = props.cards
    .map((card) => {
      let start =
        midnight +
        ((card.day - local.getUTCDay() + 7) % 7) * 86400000 +
        card.startMinute * 60000;
      let end = start + (card.endMinute - card.startMinute) * 60000;
      if (end <= now) {
        start += 604800000;
        end += 604800000;
      }
      return { card, start, end };
    })
    .sort((a, b) => a.start - b.start);
  const page =
    props.anchor === windows[0]?.start
      ? Math.max(0, Math.min(props.page, windows.length - 1))
      : 0;
  const selected = windows[page];
  const widgetHeight = environment.height ?? 180;
  const widgetWidth = environment.width ?? 180;
  const inset = widgetWidth < 200 ? 12 : 16;
  const contentWidth = Math.max(100, widgetWidth - inset * 2);
  const wide = widgetWidth >= 260;
  const dark = environment.colorScheme === "dark";
  const ink = dark ? "#F5F5F5" : "#24202B";
  const muted = dark ? "#C1BCC9" : "#615A6C";
  const surface = selected
    ? dark
      ? selected.card.darkBackground
      : selected.card.lightBackground
    : dark
      ? "#262131"
      : "#F1EBFC";
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const localDay = selected
    ? Math.floor((selected.start - midnight) / 86400000)
    : 0;
  const status =
    selected && selected.start <= now
      ? "Now"
      : page === 0
        ? "Next"
        : "Later";
  const move = (delta: number) => ({
    ...props,
    page: (page + delta + windows.length) % windows.length,
    anchor: windows[0]?.start ?? 0,
  });
  if (!selected)
    return (
      <Column
        modifiers={[
          fillMaxSize(),
          background(surface),
          cornerRadius(24),
          paddingAll(16),
        ]}
        verticalArrangement="center"
      >
        <Text color={muted} style={{ fontSize: 16 }}>
          No classes
        </Text>
      </Column>
    );
  const dayLabel = localDay === 0 ? "Today" : localDay === 1 ? "Tomorrow" : days[selected.card.day];
  const buttonSurface = dark ? "#FFFFFF18" : "#FFFFFF90";
  const followingCount = Math.max(0, Math.min(4, Math.floor((widgetHeight - 146) / 48)));
  const following = windows.slice(page + 1, page + 1 + followingCount);
  return (
    <Box modifiers={[fillMaxSize(), background(surface), cornerRadius(24), paddingAll(inset)]}>
      <Column modifiers={[fillMaxWidth()]}>
        <Row modifiers={[fillMaxWidth(), padding(0, 0, 0, 6)]}>
          <Text color={muted} style={{ fontSize: 11, fontWeight: "600" }} modifiers={[width(contentWidth / 2)]}>
            {status}
          </Text>
          <Text color={muted} style={{ fontSize: 11, textAlign: "right" }} modifiers={[width(contentWidth / 2)]}>
            {dayLabel}
          </Text>
        </Row>
        <Text color={ink} style={{ fontSize: wide ? 24 : 20, fontWeight: "700" }} maxLines={2} overflow="ellipsis">
          {selected.card.name}
        </Text>
        <Text color={muted} style={{ fontSize: 12 }} modifiers={[padding(0, 3, 0, 8)]}>
          {selected.card.time}
        </Text>
        {following.length > 0 && (
          <Column>
            <Text color={muted} style={{ fontSize: 11 }} modifiers={[padding(0, 2, 0, 6)]}>After this</Text>
            {following.map((entry) => (
              <Column key={entry.card.id} modifiers={[padding(0, 0, 0, 8)]}>
                <Text color={ink} style={{ fontSize: 13, fontWeight: "600" }} maxLines={1} overflow="ellipsis">{entry.card.name}</Text>
                <Text color={muted} style={{ fontSize: 11 }} maxLines={1}>{`${days[entry.card.day]} · ${entry.card.time}`}</Text>
              </Column>
            ))}
          </Column>
        )}
      </Column>
      {windows.length > 1 && (
        <Box modifiers={[fillMaxSize()]} contentAlignment="bottomStart">
          <Row verticalAlignment="center" modifiers={[fillMaxWidth()]}>
            <TextButton onClick={() => move(-1)} colors={{ contentColor: ink, containerColor: buttonSurface }} contentPadding={{ start: 0, end: 0, top: 0, bottom: 0 }} modifiers={[size(40, 36), cornerRadius(18), semantics({ contentDescription: "Previous class" })]}>
              <Text>‹</Text>
            </TextButton>
            <Text color={muted} style={{ fontSize: 11, textAlign: "center" }} modifiers={[width(Math.max(20, contentWidth - 80))]}>
              {`${page + 1} / ${windows.length}`}
            </Text>
            <TextButton onClick={() => move(1)} colors={{ contentColor: ink, containerColor: buttonSurface }} contentPadding={{ start: 0, end: 0, top: 0, bottom: 0 }} modifiers={[size(40, 36), cornerRadius(18), semantics({ contentDescription: "Next class" })]}>
              <Text>›</Text>
            </TextButton>
          </Row>
        </Box>
      )}
    </Box>
  );
};

export default createWidget<ScheduleWidgetProps>(
  "BunkialoTimetable",
  WidgetLayout,
  { cards: [], page: 0, anchor: 0, utcOffsetMinutes: 330 },
);
