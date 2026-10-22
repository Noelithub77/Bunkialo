import { isRunningInExpoGo } from "expo";
import { File } from "expo-file-system";
import { requireOptionalNativeModule } from "expo-modules-core";
import { widgetsDirectory } from "expo-widgets";
import { Platform } from "react-native";
import WidgetRefresh from "../../modules/widget-refresh";
import { useAuthStore } from "@/stores/auth-store";
import { useBunkStore } from "@/stores/bunk-store";
import { useTimetableStore } from "@/stores/timetable-store";
import {
  buildMessWidgetProps,
  buildTimetableWidgetProps,
  getWidgetBoundaries,
  getWidgetTimelineDates,
} from "./data";
import { encodeWidgetGradient } from "./gradient-png";
import type { ScheduleWidgetProps } from "@/types";

const GRADIENT_VERSION = 1;

// Each accent and theme gets one cached gradient image in the widgets directory.
const withGradients = (props: ScheduleWidgetProps): ScheduleWidgetProps => {
  if (!widgetsDirectory) return props;
  const imageFor = (color: string, dark: boolean): string | undefined => {
    const name = `gradient-v${GRADIENT_VERSION}-${dark ? "dark" : "light"}-${color.replace("#", "").toLowerCase()}.png`;
    try {
      const file = new File(widgetsDirectory, name);
      if (!file.exists) file.write(encodeWidgetGradient(color, dark));
      return file.uri;
    } catch (error) {
      console.warn("Widget gradient could not be written", error);
      return undefined;
    }
  };
  return {
    ...props,
    cards: props.cards.map((card) => ({
      ...card,
      darkBackgroundImage: imageFor(card.color, true),
      lightBackgroundImage: imageFor(card.color, false),
    })),
  };
};

export async function syncHomeWidgets(): Promise<void> {
  if (isRunningInExpoGo() || !requireOptionalNativeModule("ExpoWidgets")) return;
  const bunk = useBunkStore.getState();
  const timetable = useTimetableStore.getState();
  const auth = useAuthStore.getState();
  if (
    !bunk.hasHydrated ||
    !useTimetableStore.persist.hasHydrated() ||
    auth.isCheckingAuth
  )
    return;
  let classes = buildTimetableWidgetProps(
    auth.isLoggedIn ? timetable.slots : [],
    bunk.courses,
    bunk.hiddenCourses,
    auth.isLoggedIn,
  );
  let meals = buildMessWidgetProps();
  if (Platform.OS === "android") {
    classes = withGradients(classes);
    meals = withGradients(meals);
  }
  const [timetableWidget, messWidget] =
    Platform.OS === "ios"
      ? await Promise.all([import("./timetable.ios"), import("./mess.ios")])
      : await Promise.all([
          import("./timetable.android"),
          import("./mess.android"),
        ]);
  if (Platform.OS === "ios") {
    timetableWidget.default.updateTimeline(
      getWidgetTimelineDates(classes.cards).map((date) => ({
        date,
        props: classes,
      })),
    );
    messWidget.default.updateTimeline(
      getWidgetTimelineDates(meals.cards).map((date) => ({
        date,
        props: meals,
      })),
    );
  } else {
    timetableWidget.default.updateSnapshot(classes);
    messWidget.default.updateSnapshot(meals);
    await WidgetRefresh?.setSchedule(
      getWidgetBoundaries([...classes.cards, ...meals.cards]),
    );
  }
}
