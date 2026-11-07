import { Text, View } from "react-native";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { PopupCustomContentProps } from "@/types";
import { NoticeHighlights } from "./notice-highlights";

export function ReleasePopupContent({ popup }: PopupCustomContentProps) {
  const theme = useColorScheme() === "dark" ? Colors.dark : Colors.light;
  return (
    <View className="gap-4">
      <Text className="text-center text-[13px] leading-5" style={{ color: theme.textSecondary }}>
        {popup.description}
      </Text>
      {popup.highlights && <NoticeHighlights highlights={popup.highlights} />}
    </View>
  );
}
