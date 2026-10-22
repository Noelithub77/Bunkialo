/** @jsxImportSource react */
import { Box, Column, Image, Row, Text } from "@expo/ui/jetpack-compose";
import {
  background,
  cornerRadius,
  fillMaxSize,
  fillMaxWidth,
  padding,
  paddingAll,
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
  const showIcon = selected ? widgetHeight >= 240 : widgetHeight >= 180;
  const titleSize = short ? 18 : compact ? 22 : expanded ? 32 : 26;
  const titleLines = Math.min(5, Math.max(2, Math.floor(
    (widgetHeight - inset * 2 - (showIcon ? 80 : 0) - 44) / (titleSize * 1.3),
  )));
  const dark = environment.colorScheme === "dark";
  const rawColor = selected?.card.color ?? "#A78BFA";
  const seed = /^#[\da-f]{6}$/i.test(rawColor) ? rawColor : "#A78BFA";
  const channels = [1, 3, 5].map((index) => Number.parseInt(seed.slice(index, index + 2), 16));
  // Bunkialo card colours; the generated gradient image draws over them when present.
  const surface = dark ? "#0A0A0A" : "#FFFFFF";
  const gradient = dark ? selected?.card.darkBackgroundImage : selected?.card.lightBackgroundImage;
  const linear = channels.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const luminance = linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  const chip = seed;
  const muted = (luminance + 0.05) / 0.05 >= 1.05 / (luminance + 0.05) ? "#000000" : "#FFFFFF";
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
        {showIcon && <Column
          modifiers={[size(compact ? 42 : 52, compact ? 42 : 52), background(chip), cornerRadius(14)]}
          horizontalAlignment="center"
          verticalArrangement="center"
        >
          <Row modifiers={[padding(0, 0, 0, 5)]}>
            <Text color={muted} style={{ fontSize: 19, fontWeight: "700" }}>▦</Text>
          </Row>
        </Column>}
        <Text
          color={ink}
          style={{ fontSize: titleSize, fontWeight: "700", textAlign: "center" }}
          maxLines={titleLines}
          overflow="ellipsis"
          modifiers={[fillMaxWidth(), padding(0, short ? 0 : compact ? 10 : 16, 0, short ? 6 : compact ? 8 : 12)]}
        >
          {selected?.card.name ?? "Timetable"}
        </Text>
        {selected ? (
          <Column modifiers={[background(chip), cornerRadius(16), padding(10, short ? 3 : 6, 10, short ? 3 : 6)]}>
            <Text color={muted} style={{ fontSize: short ? 12 : compact ? 13 : 16, textAlign: "center", fontWeight: "500" }} maxLines={2}>
              {selected.card.time}
            </Text>
          </Column>
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
