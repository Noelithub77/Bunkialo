import { Container } from "@/components/ui/container";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useFeedbackAutofillStore } from "@/stores/feedback-autofill-store";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";

export default function MoreScreen() {
  const isDark = useColorScheme() === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const pendingCount = useFeedbackAutofillStore(
    (state) =>
      Object.values(state.courses).filter((entry) => entry.status === "pending")
        .length,
  );

  return (
    <Container>
      <View className="flex-1 gap-4 p-4">
        <View className="flex-row items-center gap-4">
          <Pressable
            accessibilityLabel="Back"
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: theme.backgroundSecondary }}
            hitSlop={8}
          >
            <Ionicons name="arrow-back" size={20} color={theme.text} />
          </Pressable>
          <Text className="text-[28px] font-bold" style={{ color: theme.text }}>
            More
          </Text>
        </View>

        <View
          className="overflow-hidden rounded-2xl border"
          style={{ borderColor: theme.border }}
        >
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/course-feedback")}
            className="flex-row items-center gap-3 px-4 py-4"
          >
            <Ionicons
              name="chatbox-ellipses-outline"
              size={20}
              color={theme.textSecondary}
            />
            <Text className="flex-1 text-[15px]" style={{ color: theme.text }}>
              Course feedback
            </Text>
            {pendingCount > 0 ? (
              <View
                className="flex-row items-center gap-1.5 rounded-full px-2.5 py-1"
                style={{ backgroundColor: theme.backgroundSecondary }}
              >
                <View
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: Colors.status.warning }}
                />
                <Text className="text-[12px] font-medium" style={{ color: theme.text }}>
                  {pendingCount} pending
                </Text>
              </View>
            ) : null}
            <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
          </Pressable>
        </View>
      </View>
    </Container>
  );
}
