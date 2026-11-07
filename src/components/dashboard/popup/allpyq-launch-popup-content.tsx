import { Text, View } from "react-native";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

const ALLPYQ_FEATURES = [
  { title: "Targeted practice", description: "Topic-wise grouping of college PYQs." },
  { title: "Spot key topics fast", description: "Trend analysis highlights what matters most." },
  { title: "Instant solutions", description: "Get help from your favorite AI models." },
  { title: "Smarter learning guides", description: "Adapts to your specific exam patterns." },
];

export function AllpyqLaunchPopupContent() {
  const theme = useColorScheme() === "dark" ? Colors.dark : Colors.light;

  return (
    <View
      className="gap-3 rounded-[22px] border p-4"
      style={{ backgroundColor: theme.backgroundSecondary, borderColor: theme.border }}
    >
      {ALLPYQ_FEATURES.map((item) => (
        <View key={item.title} className="flex-row gap-3">
          <View className="mt-[7px] h-1.5 w-1.5 rounded-full" style={{ backgroundColor: Colors.accent }} />
          <Text className="flex-1 text-[13px] leading-5" style={{ color: theme.textSecondary }}>
            <Text className="font-semibold" style={{ color: theme.text }}>{item.title}</Text>
            {"  "}
            {item.description}
          </Text>
        </View>
      ))}
    </View>
  );
}
