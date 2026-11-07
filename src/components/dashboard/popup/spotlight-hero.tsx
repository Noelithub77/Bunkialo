import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useId, type ComponentProps } from "react";
import { View } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { Colors } from "@/constants/theme";
import type { PopupNotice } from "@/types";

const mixWithWhite = (hex: string, amount: number): string => {
  const value = Number.parseInt(hex.slice(1, 7), 16);
  const channel = (shift: number) => {
    const base = (value >> shift) & 255;
    return Math.round(base + (255 - base) * amount)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${channel(16)}${channel(8)}${channel(0)}`;
};

type SpotlightHeroProps = {
  popup: PopupNotice;
  isDark: boolean;
};

export function SpotlightHero({ popup, isDark }: SpotlightHeroProps) {
  const glowId = `glow-${useId().replace(/:/g, "")}`;
  const tint = popup.iconColor ?? Colors.accent;
  const Hero = popup.hero;
  const image = isDark
    ? (popup.imageSourceDark ?? popup.imageSource)
    : (popup.imageSourceLight ?? popup.imageSource);

  return (
    <View className="h-36 items-center justify-center overflow-hidden">
      <LinearGradient
        colors={[`${tint}${isDark ? "2E" : "24"}`, `${tint}00`]}
        style={{ position: "absolute", inset: 0 }}
      />
      <Svg style={{ position: "absolute", inset: 0 }} width="100%" height="100%">
        <Defs>
          <RadialGradient id={glowId} cx="50%" cy="45%" rx="45%" ry="55%">
            <Stop offset="0" stopColor={tint} stopOpacity={isDark ? 0.45 : 0.35} />
            <Stop offset="1" stopColor={tint} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${glowId})`} />
      </Svg>
      {Hero ? (
        <Hero />
      ) : image ? (
        <Image
          source={image as ComponentProps<typeof Image>["source"]}
          style={{ width: "70%", height: 96 }}
          contentFit="contain"
        />
      ) : (
        <LinearGradient
          colors={[mixWithWhite(tint, 0.35), tint]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={{
            width: 64,
            height: 64,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 22,
            shadowColor: tint,
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.45,
            shadowRadius: 18,
            elevation: 10,
          }}
        >
          <Ionicons name={popup.icon ?? "notifications"} size={28} color={Colors.white} />
        </LinearGradient>
      )}
    </View>
  );
}
