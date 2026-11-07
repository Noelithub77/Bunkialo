import { useId } from "react";
import { View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";

const STAR_PATH =
  "M12 2.8l2.8 5.8 6.4.9-4.6 4.5 1.1 6.3L12 17.3l-5.7 3 1.1-6.3-4.6-4.5 6.4-.9z";
const SPARKLE_PATH =
  "M12 2c.6 5 2.9 8 10 10-7.1 2-9.4 5-10 10-.6-5-2.9-8-10-10 7.1-2 9.4-5 10-10z";

export function StarHero() {
  const fillId = `star-${useId().replace(/:/g, "")}`;

  return (
    <View className="h-24 w-32 items-center justify-center">
      <Svg width={76} height={76} viewBox="0 0 24 24">
        <Defs>
          <LinearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFE08A" />
            <Stop offset="0.55" stopColor="#FFB300" />
            <Stop offset="1" stopColor="#FF8A00" />
          </LinearGradient>
        </Defs>
        <Path
          d={STAR_PATH}
          fill={`url(#${fillId})`}
          stroke="#FFE7A3"
          strokeWidth={0.5}
          strokeLinejoin="round"
        />
      </Svg>
      <Svg width={13} height={13} viewBox="0 0 24 24" style={{ position: "absolute", left: 14, top: 10 }}>
        <Path d={SPARKLE_PATH} fill="#FFD36B" />
      </Svg>
      <Svg width={10} height={10} viewBox="0 0 24 24" style={{ position: "absolute", right: 16, top: 52 }}>
        <Path d={SPARKLE_PATH} fill="#FFB300" />
      </Svg>
    </View>
  );
}
