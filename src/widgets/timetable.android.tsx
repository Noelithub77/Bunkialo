/** @jsxImportSource react */
import { Box, Column, Image, Text } from "@expo/ui/jetpack-compose";
import {
  background,
  cornerRadius,
  fillMaxSize,
  fillMaxWidth,
  padding,
  paddingAll,
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
  const selected = props.cards
    .map((card) => {
      let start = midnight +
        ((card.day - local.getUTCDay() + 7) % 7) * 86400000 +
        card.startMinute * 60000;
      if (start <= now) start += 604800000;
      return { card, start };
    })
    .sort((a, b) => a.start - b.start)[0];
  const widgetWidth = environment.width ?? 180;
  const widgetHeight = environment.height ?? 180;
  const compact = widgetWidth < 220 || widgetHeight < 180;
  const expanded = widgetWidth >= 260 && widgetHeight >= 220;
  const short = widgetHeight < 130;
  const inset = short ? 8 : compact ? 12 : 16;
  const titleSize = short ? 18 : compact ? 20 : expanded ? 26 : 22;
  const titleLines = Math.min(5, Math.max(2, Math.floor(
    (widgetHeight - inset * 2 - 40) / (titleSize * 1.3),
  )));
  const dark = environment.colorScheme === "dark";
  const surface = dark ? selected?.card.darkBackground ?? "#04070D" : selected?.card.lightBackground ?? "#FFFFFF";
  const gradient = dark ? selected?.card.darkBackgroundImage : selected?.card.lightBackgroundImage;
  const muted = dark ? "#BFC3CC" : "#525866";
  const ink = dark ? "#FAFAFA" : "#171717";
  return (
    <Box modifiers={[fillMaxSize(), cornerRadius(24), background(surface)]}>
      {gradient ? (
        <Image
          source={{ uri: gradient }}
          contentScale="crop"
          contentDescription={null}
          modifiers={[fillMaxSize()]}
        />
      ) : null}
      <Column
        modifiers={[fillMaxSize(), paddingAll(inset)]}
        verticalArrangement="center"
        horizontalAlignment="center"
      >
        <Text
          color={ink}
          style={{ fontSize: titleSize, fontWeight: "600", textAlign: "center" }}
          maxLines={titleLines}
          overflow="ellipsis"
          modifiers={[fillMaxWidth(), padding(0, 0, 0, short ? 6 : 12)]}
        >
          {selected?.card.name ?? "Timetable"}
        </Text>
        {selected ? (
          <Text color={muted} style={{ fontSize: short ? 12 : compact ? 13 : 15, textAlign: "center" }} maxLines={2}>
            {selected.card.time}
          </Text>
        ) : (
          <Text
            color={dark ? "#A3A3A3" : "#525252"}
            style={{ fontSize: short ? 12 : compact ? 13 : 15, textAlign: "center" }}
            maxLines={2}
          >
            {props.emptyMessage ?? "Sign in to see your classes"}
          </Text>
        )}
      </Column>
    </Box>
  );
};

export default createWidget<ScheduleWidgetProps>(
  "BunkialoTimetable",
  WidgetLayout,
  { cards: [], page: 0, anchor: 0, utcOffsetMinutes: 330 },
);
