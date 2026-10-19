import { Ionicons } from "@expo/vector-icons";
import { Linking, Pressable, Text, View } from "react-native";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { PopupHighlight } from "@/types";

export function NoticeHighlights({ highlights }: { highlights: PopupHighlight[] }) {
  const theme = useColorScheme() === "dark" ? Colors.dark : Colors.light;
  return (
    <View className="gap-1">
      {highlights.map((highlight) => (
        <Pressable
          key={highlight.url}
          accessibilityRole="link"
          accessibilityLabel={`${highlight.title}, ${highlight.reference}`}
          onPress={() => { void Linking.openURL(highlight.url); }}
          className="flex-row items-center gap-3 rounded-xl px-3 py-3 active:opacity-70"
          style={{ backgroundColor: theme.backgroundSecondary }}
        >
          <View className="min-w-0 flex-1 gap-1">
            <View className="flex-row flex-wrap items-center gap-x-2">
              <Text className="text-[13px] font-semibold" style={{ color: theme.text }}>{highlight.title}</Text>
              <Text className="text-[11px]" style={{ color: theme.textSecondary }}>{highlight.reference}</Text>
            </View>
            <Text className="text-[12px] leading-[18px]" style={{ color: theme.textSecondary }}>{highlight.description}</Text>
          </View>
          <Ionicons name="open-outline" size={16} color={theme.textSecondary} />
        </Pressable>
      ))}
    </View>
  );
}
