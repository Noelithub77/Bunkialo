import React from "react";
import { Linking, Platform, Pressable, Text, View } from "react-native";

import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { PopupCustomContentProps } from "@/types";

const ALLPYQ_FEATURES = [
  {
    title: "Targeted practice",
    description: "Topic-wise grouping of college PYQs.",
  },
  {
    title: "Spot key topics fast",
    description: "Trend analysis highlights what matters most.",
  },
  {
    title: "Instant solutions",
    description: "Get help from your favorite AI models.",
  },
  {
    title: "Smarter learning guides",
    description: "Adapts to your specific exam patterns.",
  },
];

export function AllpyqLaunchPopupContent({ onClose }: PopupCustomContentProps) {
  const isDark = useColorScheme() === "dark";
  const theme = isDark ? Colors.dark : Colors.light;

  return (
    <View>
      <Text
        className="mb-2 text-[15px] leading-6"
        style={{ color: theme.textSecondary }}
      >
        AllPYQ is live. Prep faster with focused PYQ workflows.
      </Text>

      <View className="mb-5 mt-1 gap-2.5">
        {ALLPYQ_FEATURES.map((item) => (
          <View key={item.title} className="flex-row gap-2">
            <Text
              className="text-[15px]"
              style={{ color: theme.textSecondary }}
            >
              •
            </Text>
            <Text
              className="flex-1 text-[14px] leading-6"
              style={{ color: theme.textSecondary }}
            >
              <Text style={{ color: theme.text, fontWeight: "700" }}>
                {item.title}
              </Text>{" "}
              {item.description}
            </Text>
          </View>
        ))}
      </View>

      <View className="web:gap-3 web:sm:flex-row-reverse">
        <Pressable
          accessibilityRole="link"
          onPress={() => {
            void Linking.openURL("https://allpyq.in");
            onClose();
          }}
          className="mb-3 items-center justify-center rounded-2xl py-3.5 active:opacity-70 web:mb-0 web:sm:flex-1"
          style={{ backgroundColor: Colors.accent }}
        >
          <Text
            className="text-[14px] font-semibold"
            style={{ color: Platform.OS === "web" ? Colors.gray[950] : Colors.white, letterSpacing: 0.3 }}
          >
            Explore AllPYQ
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={onClose}
          className="items-center justify-center rounded-2xl py-3.5 active:opacity-70 web:sm:flex-1"
          style={{
            backgroundColor: isDark ? Colors.gray[800] : Colors.gray[100],
          }}
        >
          <Text
            className="text-[14px] font-semibold"
            style={{ color: theme.text, letterSpacing: 0.3 }}
          >
            Got it
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
