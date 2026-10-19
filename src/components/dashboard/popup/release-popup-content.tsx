import { Linking, Pressable, Text, View } from "react-native";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { PopupCustomContentProps } from "@/types";
import { NoticeHighlights } from "./notice-highlights";

export function ReleasePopupContent({ popup, onClose }: PopupCustomContentProps) {
  const isDark = useColorScheme() === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  return (
    <View className="gap-4">
      <Text className="text-[13px] leading-5" style={{ color: theme.textSecondary }}>
        {popup.description}
      </Text>
      {popup.highlights && <NoticeHighlights highlights={popup.highlights} />}
      <View className="flex-row items-center gap-3">
        <Pressable
          accessibilityRole="link"
          onPress={() => { if (popup.ctaUrl) void Linking.openURL(popup.ctaUrl); }}
          className="flex-1 items-center rounded-xl border py-3"
          style={{ borderColor: theme.border }}
        >
          <Text className="text-[13px] font-semibold" style={{ color: theme.text }}>
            {popup.ctaLabel}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={onClose}
          className="flex-1 items-center rounded-xl py-3"
          style={{ backgroundColor: theme.text }}
        >
          <Text className="text-[13px] font-semibold" style={{ color: theme.background }}>
            Got it
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
