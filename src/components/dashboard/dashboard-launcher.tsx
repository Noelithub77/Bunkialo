import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useCallback, useEffect, useState, type ComponentProps } from "react";
import { Animated, BackHandler, Linking, Platform, Pressable, Text, View } from "react-native";
import { Colors, Gradients } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

type LauncherItem = {
  key: string;
  label: string;
  icon: ComponentProps<typeof Ionicons>["name"];
  route?: "/gpa" | "/more";
  url?: string;
};

const FAB_SIZE = 58;
const FAB_BOTTOM = 96;
const ACTION_SIZE = 44;

const OUTPASS_URL = "https://outpass.iiitkottayam.ac.in/app";
const GATEPASS_URL = "https://gatepassstud.iiitkottayam.ac.in/index.php";
const FEASTON: LauncherItem = {
  key: "feaston",
  label: "Feaston",
  icon: "restaurant-outline",
  url: "https://feaston.iiitkottayam.ac.in/dashboard",
};

/** Top to bottom, so the last item sits closest to the button. */
export function getLauncherItems(username: string | null): LauncherItem[] {
  const isOldBatch = username?.startsWith("2022") || username?.startsWith("2023");
  const batchItems: LauncherItem[] = isOldBatch
    ? [
        { key: "outpass-rfid", label: "Outpass RFID", icon: "card-outline", url: OUTPASS_URL },
        { key: "outpass-fingerprint", label: "Outpass fingerprint", icon: "finger-print-outline", url: GATEPASS_URL },
        FEASTON,
      ]
    : [
        {
          key: "outpass",
          label: "Outpass",
          icon: "exit-outline",
          url: username?.startsWith("2024") ? GATEPASS_URL : OUTPASS_URL,
        },
        FEASTON,
        { key: "allpyq", label: "AllPYQ", icon: "book-outline", url: "https://allpyq.in" },
      ];

  return [
    { key: "more", label: "More", icon: "ellipsis-horizontal", route: "/more" },
    { key: "gpa", label: "GPA calculator", icon: "calculator-outline", route: "/gpa" },
    { key: "attendance", label: "Attendance", icon: "calendar-outline", url: "https://attendance.iiitkottayam.ac.in/" },
    ...batchItems,
  ];
}

export function DashboardLauncher({ items }: { items: LauncherItem[] }) {
  const isDark = useColorScheme() === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [progress] = useState(() => new Animated.Value(0));

  const toggle = useCallback(
    (next: boolean) => {
      if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setOpen(next);
      if (next) setMounted(true);
      Animated.spring(progress, {
        toValue: next ? 1 : 0,
        damping: 20,
        stiffness: 260,
        mass: 0.7,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished && !next) setMounted(false);
      });
    },
    [progress],
  );

  useEffect(() => {
    if (!open) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      toggle(false);
      return true;
    });
    return () => subscription.remove();
  }, [open, toggle]);

  const openItem = (item: LauncherItem) => {
    toggle(false);
    if (item.route) router.push(item.route);
    else if (item.url) void Linking.openURL(item.url);
  };

  return (
    <View pointerEvents="box-none" style={{ position: "absolute", inset: 0 }}>
      {mounted ? (
        <>
          <Animated.View
            style={{
              position: "absolute",
              inset: 0,
              backgroundColor: isDark ? "rgba(0,0,0,0.78)" : "rgba(15,15,15,0.4)",
              opacity: progress,
            }}
          >
            <Pressable
              className="flex-1"
              accessibilityLabel="Close menu"
              onPress={() => toggle(false)}
            />
          </Animated.View>

          <View
            pointerEvents={open ? "box-none" : "none"}
            className="absolute items-end gap-3.5"
            style={{
              right: 16 + (FAB_SIZE - ACTION_SIZE) / 2,
              bottom: FAB_BOTTOM + FAB_SIZE + 16,
            }}
          >
            {items.map((item, index) => {
              // Rows nearest the button appear first.
              const start = Math.min((items.length - 1 - index) * 0.07, 0.35);
              const appear = progress.interpolate({
                inputRange: [start, start + 0.55],
                outputRange: [0, 1],
                extrapolate: "clamp",
              });
              return (
                <Animated.View
                  key={item.key}
                  style={{
                    opacity: appear,
                    transform: [{ translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
                  }}
                >
                  <Pressable
                    accessibilityRole={item.url ? "link" : "button"}
                    accessibilityLabel={item.label}
                    accessibilityHint={item.url ? "Opens in your browser" : undefined}
                    onPress={() => openItem(item)}
                    className="flex-row items-center gap-3 active:opacity-70"
                  >
                    <View
                      className="rounded-full px-3 py-1.5"
                      style={{
                        backgroundColor: isDark ? "rgba(24,24,24,0.92)" : "rgba(255,255,255,0.95)",
                      }}
                    >
                      <Text className="text-[13px] font-semibold" style={{ color: theme.text }}>
                        {item.label}
                      </Text>
                    </View>
                    <View
                      className="items-center justify-center rounded-full border"
                      style={{
                        width: ACTION_SIZE,
                        height: ACTION_SIZE,
                        backgroundColor: theme.backgroundSecondary,
                        borderColor: theme.border,
                      }}
                    >
                      <Ionicons name={item.icon} size={20} color={theme.text} />
                    </View>
                  </Pressable>
                </Animated.View>
              );
            })}
          </View>
        </>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={open ? "Close menu" : "Open menu"}
        accessibilityState={{ expanded: open }}
        onPress={() => toggle(!open)}
        className="absolute right-4 overflow-hidden rounded-[22px] border active:opacity-90"
        style={{
          bottom: FAB_BOTTOM,
          width: FAB_SIZE,
          height: FAB_SIZE,
          borderColor: "rgba(255,255,255,0.1)",
          shadowColor: Colors.black,
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.35,
          shadowRadius: 18,
          elevation: 10,
        }}
      >
        <LinearGradient
          colors={Gradients.graphite}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <Animated.View
            style={{
              position: "absolute",
              opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
              transform: [{ rotate: progress.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "90deg"] }) }],
            }}
          >
            <Ionicons name="grid" size={22} color={Gradients.accent[0]} />
          </Animated.View>
          <Animated.View
            style={{
              position: "absolute",
              opacity: progress,
              transform: [{ rotate: progress.interpolate({ inputRange: [0, 1], outputRange: ["-90deg", "0deg"] }) }],
            }}
          >
            <Ionicons name="close" size={26} color={Gradients.accent[0]} />
          </Animated.View>
        </LinearGradient>
      </Pressable>
    </View>
  );
}
