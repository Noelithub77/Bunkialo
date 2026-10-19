import { remapProps } from "nativewind";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
import type { LoginLayoutProps } from "./login-layout";

remapProps(KeyboardAwareScrollView, {
  contentContainerClassName: "contentContainerStyle",
});

export function LoginLayout({
  children,
  step,
  showNavigation,
  onBack,
  onOpenPortal,
  backgroundNotice,
}: LoginLayoutProps) {
  return (
    <SafeAreaView className="login-web-shell flex-1">
      <KeyboardAwareScrollView
        contentContainerClassName="flex-grow px-5 py-8 sm:px-10 sm:py-12 lg:justify-center lg:px-16"
        keyboardShouldPersistTaps="handled"
        bottomOffset={24}
      >
        <View className="mx-auto w-full max-w-[1120px] flex-1 justify-center gap-10 lg:flex-none lg:flex-row lg:items-center lg:gap-20 xl:gap-28">
          <View className="mx-auto w-full max-w-[440px] gap-5 lg:mx-0 lg:max-w-none lg:flex-1 lg:gap-12">
            <View className="flex-row items-center gap-3">
              <View className="h-10 w-10 items-center justify-center rounded-xl border border-amber-300/20 bg-amber-300/10">
                <MaterialCommunityIcons name="school-outline" size={23} color="#FBBF24" />
              </View>
              <Text className="text-2xl font-bold tracking-[-0.8px] text-zinc-50">
                Bunkialo
              </Text>
            </View>
            <View className="hidden gap-5 lg:flex">
              <Text
                role="heading"
                aria-level={1}
                className="text-[56px] font-semibold leading-[62px] tracking-[-2.5px] text-zinc-50 xl:text-[64px] xl:leading-[70px]"
              >
                Your campus.{"\n"}
                <Text className="text-amber-300">A little simpler.</Text>
              </Text>
              <Text className="max-w-[360px] text-lg leading-7 text-zinc-400">
                Attendance, assignments and your timetable. All in one place.
              </Text>
            </View>
            <View className="hidden flex-row flex-wrap gap-x-5 gap-y-3 lg:flex">
              <View className="flex-row items-center gap-2">
                <MaterialCommunityIcons name="calendar-check-outline" size={17} color="#A1A1AA" />
                <Text className="text-sm text-zinc-400">Stay on track</Text>
              </View>
              <View className="flex-row items-center gap-2">
                <MaterialCommunityIcons name="coffee-outline" size={17} color="#A1A1AA" />
                <Text className="text-sm text-zinc-400">Plan your breaks</Text>
              </View>
            </View>
          </View>

          <View className="mx-auto w-full max-w-[440px] gap-6 lg:mx-0">
            <View className="gap-7 rounded-[24px] border border-zinc-800 bg-zinc-950/90 p-6 sm:p-8">
              <View role="list" aria-label="Account setup progress" className="flex-row items-center gap-3">
                <View role="listitem" className="flex-row items-center gap-2">
                  <View className="h-6 w-6 items-center justify-center rounded-full bg-amber-300">
                    {step === "attendance" ? (
                      <MaterialCommunityIcons name="check" size={15} color="#18181B" />
                    ) : (
                      <Text className="text-xs font-bold text-zinc-900">1</Text>
                    )}
                  </View>
                  <Text className="text-xs font-medium text-zinc-200">
                    {step === "lms" ? "Moodle" : "Connected"}
                  </Text>
                </View>
                <View className="h-px flex-1 bg-zinc-700" />
                <View role="listitem" className="flex-row items-center gap-2">
                  <View className={`h-6 w-6 items-center justify-center rounded-full border ${step === "attendance" ? "border-amber-300 bg-amber-300" : "border-zinc-700"}`}>
                    <Text className={`text-xs font-bold ${step === "attendance" ? "text-zinc-900" : "text-zinc-500"}`}>2</Text>
                  </View>
                  <Text className={`text-xs font-medium ${step === "attendance" ? "text-zinc-200" : "text-zinc-500"}`}>
                    Attendance
                  </Text>
                </View>
              </View>
              {children}
              {showNavigation ? (
                <View className="flex-row items-center justify-between gap-3 border-t border-zinc-800 pt-5">
                  <Pressable accessibilityRole="button" onPress={onBack} className="rounded py-1">
                    <Text className="text-sm text-zinc-400">Back</Text>
                  </Pressable>
                  <Pressable accessibilityRole="link" onPress={onOpenPortal} className="rounded py-1">
                    <Text className="text-sm text-zinc-300">Open portal ↗</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
            <View className="flex-row items-start justify-center gap-2 px-3">
              <MaterialCommunityIcons name="lock-outline" size={14} color="#71717A" />
              <Text className="max-w-[310px] flex-shrink text-center text-xs leading-[18px] text-zinc-500">
                Saved in this browser to keep you signed in.
              </Text>
            </View>
            {backgroundNotice}
          </View>
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}
