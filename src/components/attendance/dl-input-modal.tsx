import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  Text,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

interface DLInputModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (note: string) => void;
}

export function DLInputModal({
  visible,
  onClose,
  onConfirm,
}: DLInputModalProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;

  const [note, setNote] = useState("");

  useEffect(() => {
    if (visible) setNote("");
  }, [visible]);

  const handleConfirm = () => {
    onConfirm(note);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAwareScrollView
        className="flex-1"
        contentContainerClassName="flex-grow items-center justify-center py-6"
        keyboardShouldPersistTaps="handled"
        bottomOffset={24}
      >
        <Pressable className="absolute inset-0 bg-black/60" onPress={onClose} />
        <View
          className="w-[90%] max-w-[360px] rounded-2xl p-6"
          style={{ backgroundColor: theme.background }}
        >
          <View className="mb-4 flex-row items-center gap-2">
            <Ionicons
              name="briefcase-outline"
              size={20}
              color={Colors.status.info}
            />
            <Text className="text-lg font-semibold" style={{ color: theme.text }}>
              Mark full-day duty leave
            </Text>
          </View>

          <Input
            placeholder="(chAi talks)"
            accessibilityLabel="Reason"
            value={note}
            onChangeText={setNote}
            autoFocus
          />

          <View className="mt-6 w-full flex-row gap-2">
            <Button
              title="Cancel"
              variant="secondary"
              onPress={onClose}
              className="flex-1"
            />
            <Button
              title="Mark DL"
              onPress={handleConfirm}
              className="flex-1"
            />
          </View>
        </View>
      </KeyboardAwareScrollView>
    </Modal>
  );
}
