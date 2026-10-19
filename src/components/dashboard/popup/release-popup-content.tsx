import { Pressable, Text, View } from "react-native";
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
      <Pressable
        accessibilityRole="button"
        onPress={onClose}
        className="items-center rounded-xl border py-3"
        style={{ borderColor: theme.border }}
      >
        <Text className="text-[13px] font-semibold" style={{ color: theme.text }}>
          Got it
        </Text>
      </Pressable>
    </View>
  );
}
