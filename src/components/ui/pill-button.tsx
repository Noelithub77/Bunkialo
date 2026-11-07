import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import type { ComponentProps } from "react";
import { Pressable, Text, View } from "react-native";
import { Colors, Gradients } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

type PillButtonProps = {
  label: string;
  onPress: () => void;
  variant?: "accent" | "soft" | "ghost";
  icon?: ComponentProps<typeof Ionicons>["name"];
  accessibilityRole?: "button" | "link";
  className?: string;
};

const ACCENT_TEXT = "#1A1100";

export function PillButton({
  label,
  onPress,
  variant = "accent",
  icon,
  accessibilityRole = "button",
  className,
}: PillButtonProps) {
  const isDark = useColorScheme() === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const color =
    variant === "accent" ? ACCENT_TEXT : variant === "soft" ? theme.text : theme.textSecondary;

  const content = (
    <View className="flex-row items-center justify-center gap-2">
      {icon ? <Ionicons name={icon} size={17} color={color} /> : null}
      <Text className="text-[14px] font-bold" style={{ color }}>
        {label}
      </Text>
    </View>
  );

  return (
    <Pressable
      accessibilityRole={accessibilityRole}
      accessibilityLabel={label}
      onPress={onPress}
      className={`overflow-hidden rounded-full active:opacity-80 ${variant === "ghost" ? "h-10" : "h-12"} ${className ?? ""}`}
      style={
        variant === "accent"
          ? {
              shadowColor: Colors.accent,
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.28,
              shadowRadius: 14,
              elevation: 4,
            }
          : variant === "soft"
            ? {
                backgroundColor: theme.backgroundSecondary,
                borderColor: theme.border,
                borderWidth: 1,
              }
            : undefined
      }
    >
      {variant === "accent" ? (
        <LinearGradient
          colors={Gradients.accent}
          style={{ flex: 1, justifyContent: "center", borderRadius: 999 }}
        >
          {content}
        </LinearGradient>
      ) : (
        <View className="flex-1 justify-center">{content}</View>
      )}
    </Pressable>
  );
}
