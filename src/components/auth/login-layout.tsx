import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";

export interface LoginLayoutProps {
  children: ReactNode;
  step: "lms" | "attendance";
  showNavigation: boolean;
  onBack: () => void;
  onOpenPortal: () => void;
  backgroundNotice: ReactNode;
}

export function LoginLayout({
  children,
  step,
  showNavigation,
  onBack,
  onOpenPortal,
  backgroundNotice,
}: LoginLayoutProps) {
  return (
    <SafeAreaView className="flex-1 px-5">
      <KeyboardAwareScrollView
        contentContainerClassName="flex-grow justify-center py-8"
        keyboardShouldPersistTaps="handled"
        bottomOffset={24}
      >
        <View className="mx-auto w-full max-w-[520px] gap-6">
          <View className="gap-3 px-1">
            <Text className="text-[42px] font-extrabold leading-[46px] tracking-[-1.5px] text-zinc-50 sm:text-5xl sm:leading-[52px]">
              Bunkialo
            </Text>
            <View className="flex-row items-center gap-2">
              <View className="rounded-full border border-zinc-700 bg-zinc-900 px-2.5 py-1">
                <Text className="text-[11px] font-semibold text-zinc-300">
                  Step {step === "lms" ? "1" : "2"} of 2
                </Text>
              </View>
              <Text className="flex-1 text-xs leading-5 text-zinc-400">
                {step === "lms"
                  ? "Connect your LMS account first."
                  : "Now connect your attendance account."}
              </Text>
            </View>
          </View>
          <View className="rounded-[28px] border border-zinc-700/60 bg-black/80 p-5">
            {children}
          </View>
          {showNavigation ? (
            <View className="flex-row items-center justify-between">
              <Pressable onPress={onBack}>
                <Text className="text-sm font-semibold text-zinc-400">Back</Text>
              </Pressable>
              <Pressable onPress={onOpenPortal}>
                <Text className="text-sm font-semibold text-zinc-200">
                  Open attendance portal ↗
                </Text>
              </Pressable>
            </View>
          ) : null}
          <Text className="text-center text-xs text-zinc-500">
            Credentials stay encrypted on this device.
          </Text>
          {backgroundNotice}
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}
