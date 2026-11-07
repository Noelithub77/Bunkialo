import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useState, type ComponentProps } from "react";
import { Animated, BackHandler, Platform, Pressable, Text, View } from "react-native";
import { Colors, Gradients } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

type IconName = ComponentProps<typeof Ionicons>["name"];

export type FabMenuItem = {
  key: string;
  label: string;
  icon: IconName;
  onPress: () => void;
  /** Tints the action circle for add and active-mode actions. */
  tone?: "success" | "info";
  opensExternally?: boolean;
};

const FAB_SIZE = 58;
const ACTION_SIZE = 44;

const lightButton = ["#FFFFFF", "#F0F0F0"] as const;

/** Floating squircle button that fans a labelled list upwards. Rows run top to bottom. */
export function FabMenu({
  items,
  icon = "grid",
  bottom = 96,
}: {
  items: FabMenuItem[];
  icon?: IconName;
  bottom?: number;
}) {
  const isDark = useColorScheme() === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const iconColor = isDark ? Gradients.accent[0] : theme.text;
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

  const runItem = (item: FabMenuItem) => {
    toggle(false);
    item.onPress();
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
              bottom: bottom + FAB_SIZE + 16,
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
              const toneColor =
                item.tone === "success"
                  ? Colors.status.success
                  : item.tone === "info"
                    ? Colors.status.info
                    : null;
              return (
                <Animated.View
                  key={item.key}
                  style={{
                    opacity: appear,
                    transform: [{ translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
                  }}
                >
                  <Pressable
                    accessibilityRole={item.opensExternally ? "link" : "button"}
                    accessibilityLabel={item.label}
                    accessibilityHint={item.opensExternally ? "Opens in your browser" : undefined}
                    onPress={() => runItem(item)}
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
                        backgroundColor: toneColor ?? theme.backgroundSecondary,
                        borderColor: toneColor ?? theme.border,
                      }}
                    >
                      <Ionicons name={item.icon} size={20} color={toneColor ? Colors.white : theme.text} />
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
          bottom,
          width: FAB_SIZE,
          height: FAB_SIZE,
          borderColor: isDark ? "rgba(255,255,255,0.1)" : theme.border,
          shadowColor: Colors.black,
          shadowOffset: { width: 0, height: isDark ? 10 : 6 },
          shadowOpacity: isDark ? 0.35 : 0.16,
          shadowRadius: isDark ? 18 : 14,
          elevation: isDark ? 10 : 6,
        }}
      >
        <LinearGradient
          colors={isDark ? Gradients.graphite : lightButton}
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
            <Ionicons name={icon} size={22} color={iconColor} />
          </Animated.View>
          <Animated.View
            style={{
              position: "absolute",
              opacity: progress,
              transform: [{ rotate: progress.interpolate({ inputRange: [0, 1], outputRange: ["-90deg", "0deg"] }) }],
            }}
          >
            <Ionicons name="close" size={26} color={iconColor} />
          </Animated.View>
        </LinearGradient>
      </Pressable>
    </View>
  );
}
