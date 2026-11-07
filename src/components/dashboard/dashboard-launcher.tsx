import { Feather, Ionicons } from "@expo/vector-icons";
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
  colors: readonly [string, string];
  route?: "/gpa" | "/more";
  url?: string;
};

const FAB_SIZE = 58;
const FAB_BOTTOM = 96;
const GRID_GAP = 8;

const OUTPASS_URL = "https://outpass.iiitkottayam.ac.in/app";
const GATEPASS_URL = "https://gatepassstud.iiitkottayam.ac.in/index.php";
const FEASTON: LauncherItem = {
  key: "feaston",
  label: "Feaston",
  icon: "restaurant-outline",
  colors: ["#FDA4AF", "#E11D48"],
  url: "https://feaston.iiitkottayam.ac.in/dashboard",
};

export function getLauncherItems(username: string | null, isDark: boolean): LauncherItem[] {
  const isOldBatch = username?.startsWith("2022") || username?.startsWith("2023");
  const batchItems: LauncherItem[] = isOldBatch
    ? [
        { key: "outpass-rfid", label: "Outpass RFID", icon: "card-outline", colors: ["#6EE7B7", "#059669"], url: OUTPASS_URL },
        { key: "outpass-fingerprint", label: "Fingerprint", icon: "finger-print-outline", colors: ["#5EEAD4", "#0D9488"], url: GATEPASS_URL },
        FEASTON,
      ]
    : [
        {
          key: "outpass",
          label: "Outpass",
          icon: "exit-outline",
          colors: ["#6EE7B7", "#059669"],
          url: username?.startsWith("2024") ? GATEPASS_URL : OUTPASS_URL,
        },
        FEASTON,
        { key: "allpyq", label: "AllPYQ", icon: "book-outline", colors: ["#C4B5FD", "#7C3AED"], url: "https://allpyq.in" },
      ];

  return [
    { key: "gpa", label: "GPA", icon: "calculator-outline", colors: ["#FFD36B", "#FF9800"], route: "/gpa" },
    {
      key: "attendance",
      label: "Attendance",
      icon: "calendar-outline",
      colors: ["#7CB4FF", "#2563EB"],
      url: "https://attendance.iiitkottayam.ac.in/",
    },
    ...batchItems,
    {
      key: "more",
      label: "More",
      icon: "ellipsis-horizontal",
      colors: isDark ? ["#5A5A5A", "#262626"] : ["#8A8A8A", "#4A4A4A"],
      route: "/more",
    },
  ];
}

export function DashboardLauncher({ items }: { items: LauncherItem[] }) {
  const isDark = useColorScheme() === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [gridWidth, setGridWidth] = useState(0);
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

  const tileWidth = gridWidth > 0 ? (gridWidth - GRID_GAP * 2) / 3 : 0;

  return (
    <View pointerEvents="box-none" style={{ position: "absolute", inset: 0 }}>
      {mounted ? (
        <>
          <Animated.View
            style={{
              position: "absolute",
              inset: 0,
              backgroundColor: isDark ? "rgba(0,0,0,0.55)" : "rgba(15,15,15,0.25)",
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
            pointerEvents="box-none"
            className="absolute left-4 right-4 items-end"
            style={{ bottom: FAB_BOTTOM + FAB_SIZE + 12 }}
          >
            <Animated.View
              pointerEvents={open ? "auto" : "none"}
              style={{
                width: "100%",
                maxWidth: 380,
                overflow: "hidden",
                borderRadius: 30,
                borderWidth: 1,
                padding: 12,
                borderColor: theme.border,
                opacity: progress,
                transformOrigin: "bottom right",
                transform: [
                  { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
                  { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
                ],
                shadowColor: Colors.black,
                shadowOffset: { width: 0, height: 18 },
                shadowOpacity: isDark ? 0.5 : 0.14,
                shadowRadius: 36,
                elevation: 14,
              }}
            >
              <LinearGradient
                colors={isDark ? Gradients.dark.sheet : Gradients.light.sheet}
                style={{ position: "absolute", inset: 0 }}
              />
              <View
                className="flex-row flex-wrap"
                style={{ gap: GRID_GAP }}
                onLayout={(event) => setGridWidth(event.nativeEvent.layout.width)}
              >
                {items.map((item) => (
                  <Pressable
                    key={item.key}
                    accessibilityRole={item.url ? "link" : "button"}
                    accessibilityLabel={item.label}
                    accessibilityHint={item.url ? "Opens in your browser" : undefined}
                    onPress={() => openItem(item)}
                    className="items-center gap-2 rounded-[22px] border px-1 pb-3 pt-3.5 active:opacity-70"
                    style={{
                      width: tileWidth,
                      backgroundColor: theme.backgroundSecondary,
                      borderColor: theme.border,
                    }}
                  >
                    {item.url ? (
                      <View className="absolute right-2.5 top-2.5">
                        <Feather name="arrow-up-right" size={12} color={theme.textSecondary} />
                      </View>
                    ) : null}
                    <LinearGradient
                      colors={item.colors}
                      start={{ x: 0.2, y: 0 }}
                      end={{ x: 0.8, y: 1 }}
                      style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 16 }}
                    >
                      <Ionicons name={item.icon} size={21} color={Colors.white} />
                    </LinearGradient>
                    <Text
                      className="text-center text-[12px] font-semibold"
                      style={{ color: theme.text }}
                      numberOfLines={1}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Animated.View>
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
