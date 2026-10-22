/** @jsxImportSource react */
import { Column, Text } from "@expo/ui/jetpack-compose";
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
  const ink = dark ? "#FFEDD3" : "#4C2E16";
  const muted = dark ? "#F0C894" : "#81501F";
  const chip = dark ? "#5A3C25" : "#F2D9B4";
  const minRowHeight = compact ? 18 : expanded ? 22 : 21;
  const availableHeight = Math.max(minRowHeight, widgetHeight - inset * 2 - (compact ? 76 : 92));
  const capacity = Math.max(1, Math.floor(availableHeight / minRowHeight));
  const items = selected?.card.items.slice(0, capacity) ?? [];
  const rowHeight = Math.min(36, Math.max(minRowHeight, availableHeight / Math.max(1, items.length)));
  return (
    <Column
      modifiers={[
        fillMaxSize(),
        background(dark ? "#382B20" : "#FFF0D9"),
        cornerRadius(24),
        paddingAll(inset),
      ]}
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
  );
};

export default createWidget<ScheduleWidgetProps>(
  "BunkialoMess",
  WidgetLayout,
  buildMessWidgetProps(),
);
