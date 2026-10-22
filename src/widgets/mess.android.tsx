/** @jsxImportSource react */
import { Box, Column, Image, Text } from "@expo/ui/jetpack-compose";
import {
  background,
  cornerRadius,
  fillMaxSize,
  fillMaxWidth,
  height,
  padding,
  paddingAll,
} from "@expo/ui/jetpack-compose/modifiers";
import { createWidget, type WidgetEnvironment } from "expo-widgets";
import type { ScheduleWidgetProps } from "@/types";
import { buildMessWidgetProps } from "./data";

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
  const expanded = widgetWidth >= 260 && widgetHeight >= 260;
  const inset = compact ? 12 : 16;
  const dark = environment.colorScheme === "dark";
  const rawColor = selected?.card.color ?? "#F59E0B";
  const seed = /^#[\da-f]{6}$/i.test(rawColor) ? rawColor : "#F59E0B";
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
  const minRowHeight = compact ? 18 : expanded ? 22 : 21;
  const availableHeight = Math.max(minRowHeight, widgetHeight - inset * 2 - (compact ? 76 : 92));
  const capacity = Math.max(1, Math.floor(availableHeight / minRowHeight));
  const items = selected?.card.items.slice(0, capacity) ?? [];
  const rowHeight = Math.min(36, Math.max(minRowHeight, availableHeight / Math.max(1, items.length)));
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
          style={{ fontSize: compact ? 24 : expanded ? 34 : 30, fontWeight: "700", textAlign: "center" }}
          maxLines={1}
          overflow="ellipsis"
          modifiers={[fillMaxWidth(), padding(0, 0, 0, compact ? 6 : 10)]}
        >
          {selected?.card.name ?? "Mess menu"}
        </Text>
        <Column modifiers={[background(chip), cornerRadius(16), padding(12, 5, 12, 5)]}>
          <Text color={muted} style={{ fontSize: compact ? 12 : 14, fontWeight: "500", textAlign: "center" }}>
            {selected?.card.time ?? "Open menu"}
          </Text>
        </Column>
        <Column modifiers={[height(compact ? 10 : 16)]} />
        {Array.from({ length: Math.ceil(items.length / 8) }, (_, group) => (
          <Column key={group} horizontalAlignment="center">
            {items.slice(group * 8, group * 8 + 8).map((item, index) => (
              <Text
                key={`${group}-${index}`}
                color={ink}
                style={{ fontSize: compact ? 12 : expanded ? 16 : 14, textAlign: "center" }}
                maxLines={1}
                overflow="ellipsis"
                modifiers={[fillMaxWidth(), height(rowHeight)]}
              >
                {item}
              </Text>
            ))}
          </Column>
        ))}
      </Column>
    </Box>
  );
};

export default createWidget<ScheduleWidgetProps>(
  "BunkialoMess",
  WidgetLayout,
  buildMessWidgetProps(),
);
