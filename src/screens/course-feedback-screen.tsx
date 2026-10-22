import { ConfirmModal } from "@/components/modals/confirm-modal";
import { Toast } from "@/components/shared/ui/molecules/toast";
import { Container } from "@/components/ui/container";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  type CourseFeedbackEntry,
  type CourseFeedbackStatus,
  useFeedbackAutofillStore,
} from "@/stores/feedback-autofill-store";
import { extractCourseCode, extractCourseName } from "@/utils/course-name";
import { Ionicons } from "@expo/vector-icons";
import { formatDistanceToNow } from "date-fns";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

type Theme = typeof Colors.light;

const RATINGS = ["0", "1", "2", "3", "4", "5"];
const STALE_AFTER_MS = 10 * 60 * 1000;

const STATUS_PRESENTATION: Record<
  CourseFeedbackStatus,
  { label: string; color: string; busy?: boolean }
> = {
  unknown: { label: "Not checked", color: Colors.gray[500] },
  checking: { label: "Checking", color: Colors.status.info, busy: true },
  pending: { label: "Pending", color: Colors.status.warning },
  submitting: { label: "Submitting", color: Colors.status.info, busy: true },
  verifying: { label: "Verifying", color: Colors.status.info, busy: true },
  done: { label: "Done", color: Colors.status.success },
  none: { label: "No form", color: Colors.gray[500] },
  closed: { label: "Closed", color: Colors.gray[500] },
  failed: { label: "Failed", color: Colors.status.danger },
};

function StatusChip({ status, theme }: { status: CourseFeedbackStatus; theme: Theme }) {
  const { label, color, busy } = STATUS_PRESENTATION[status];
  return (
    <View
      className="flex-row items-center gap-1.5 rounded-full px-2.5 py-1"
      style={{ backgroundColor: theme.backgroundSecondary }}
    >
      {busy ? (
        <ActivityIndicator size={10} color={color} />
      ) : (
        <View className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      )}
      <Text className="text-[12px] font-medium" style={{ color: theme.text }}>
        {label}
      </Text>
    </View>
  );
}

function RatingPicker({
  value,
  onChange,
  theme,
  allowDefault,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  theme: Theme;
  allowDefault?: boolean;
}) {
  const options: (string | null)[] = allowDefault ? [null, ...RATINGS] : RATINGS;
  return (
    <View className="flex-row gap-1.5">
      {options.map((option) => {
        const selected = option === value;
        return (
          <Pressable
            key={option ?? "default"}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={option === null ? "Default rating" : `Rating ${option}`}
            onPress={() => onChange(option)}
            className="h-9 flex-1 items-center justify-center rounded-lg border"
            style={{
              borderColor: selected ? theme.text : theme.border,
              backgroundColor: selected ? theme.text : "transparent",
            }}
          >
            <Text
              className="text-[13px] font-semibold"
              style={{ color: selected ? theme.background : theme.text }}
            >
              {option ?? "Auto"}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function CourseFeedbackScreen() {
  const isDark = useColorScheme() === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const courses = useFeedbackAutofillStore((state) => state.courses);
  const courseOrder = useFeedbackAutofillStore((state) => state.courseOrder);
  const courseDefaults = useFeedbackAutofillStore((state) => state.courseDefaults);
  const defaultGrade = useFeedbackAutofillStore((state) => state.defaultGrade);
  const defaultText = useFeedbackAutofillStore((state) => state.defaultText);
  const activity = useFeedbackAutofillStore((state) => state.activity);
  const error = useFeedbackAutofillStore((state) => state.error);
  const lastCheckedAt = useFeedbackAutofillStore((state) => state.lastCheckedAt);
  const checkAll = useFeedbackAutofillStore((state) => state.checkAll);
  const submit = useFeedbackAutofillStore((state) => state.submit);
  const setDefaults = useFeedbackAutofillStore((state) => state.setDefaults);
  const setCourseDefault = useFeedbackAutofillStore((state) => state.setCourseDefault);
  const clearCourseDefault = useFeedbackAutofillStore(
    (state) => state.clearCourseDefault,
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmIds, setConfirmIds] = useState<string[] | null>(null);

  const entries = useMemo(
    () =>
      courseOrder
        .map((id) => courses[id])
        .filter((entry): entry is CourseFeedbackEntry => entry !== undefined),
    [courseOrder, courses],
  );
  const pendingIds = entries
    .filter((entry) => entry.status === "pending")
    .map((entry) => entry.courseId);
  const failedIds = entries.filter((entry) => entry.status === "failed").map((entry) => entry.courseId);
  const actionIds = pendingIds.length > 0 ? pendingIds : failedIds;
  const doneCount = entries.filter((entry) => entry.status === "done").length;
  const busy = activity !== "idle";
  const inFlight = entries.filter((entry) =>
    ["submitting", "verifying"].includes(entry.status),
  ).length;

  useEffect(() => {
    const stale =
      !lastCheckedAt || Date.now() - new Date(lastCheckedAt).getTime() > STALE_AFTER_MS;
    if (stale) void checkAll();
  }, []);

  const runSubmit = async (courseIds: string[]) => {
    setConfirmIds(null);
    const { submitted, failed } = await submit(courseIds);
    if (failed > 0) {
      Toast.show(`${submitted} submitted, ${failed} failed`, { type: "warning" });
    } else if (submitted > 0) {
      Toast.show(`${submitted} submitted and verified`, { type: "success" });
    }
  };

  const activityLabel =
    activity === "checking"
      ? "Checking courses"
      : activity === "submitting"
        ? `Submitting ${inFlight > 0 ? `· ${inFlight} in progress` : ""}`
        : activity === "verifying"
          ? "Verifying with LMS"
          : lastCheckedAt
            ? `Checked ${formatDistanceToNow(new Date(lastCheckedAt), { addSuffix: true })}`
            : "Not checked yet";

  return (
    <Container>
      <View className="flex-1">
        <View className="flex-row items-center gap-4 p-4">
          <Pressable
            accessibilityLabel="Back"
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: theme.backgroundSecondary }}
            hitSlop={8}
          >
            <Ionicons name="arrow-back" size={20} color={theme.text} />
          </Pressable>
          <View className="flex-1">
            <Text className="text-[28px] font-bold" style={{ color: theme.text }}>
              Course feedback
            </Text>
            <Text className="text-[12px]" style={{ color: theme.textSecondary }}>
              {activityLabel}
            </Text>
          </View>
          <Pressable
            accessibilityLabel="Check again"
            disabled={busy}
            onPress={() => void checkAll()}
            className="h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: theme.backgroundSecondary, opacity: busy ? 0.5 : 1 }}
            hitSlop={8}
          >
            {activity === "checking" ? (
              <ActivityIndicator size="small" color={theme.text} />
            ) : (
              <Ionicons name="refresh" size={18} color={theme.text} />
            )}
          </Pressable>
        </View>

        <KeyboardAwareScrollView
          keyboardShouldPersistTaps="handled"
          bottomOffset={24}
          contentContainerClassName="gap-4 px-4 pb-6"
        >
          <View className="gap-3 rounded-2xl border p-4" style={{ borderColor: theme.border }}>
            <Text className="text-[13px] font-semibold" style={{ color: theme.textSecondary }}>
              Rating
            </Text>
            <RatingPicker
              value={defaultGrade}
              theme={theme}
              onChange={(value) => setDefaults(value ?? defaultGrade, defaultText)}
            />
            <Text className="text-[13px] font-semibold" style={{ color: theme.textSecondary }}>
              Comment
            </Text>
            <TextInput
              value={defaultText}
              onChangeText={(value) => setDefaults(defaultGrade, value)}
              placeholder="-"
              placeholderTextColor={theme.textSecondary}
              className="rounded-xl border px-3 py-2.5 text-[14px]"
              style={{ borderColor: theme.border, color: theme.text }}
            />
          </View>

          {error ? (
            <View
              className="flex-row items-center gap-2 rounded-xl px-3 py-2.5"
              style={{ backgroundColor: theme.backgroundSecondary }}
            >
              <Ionicons name="alert-circle" size={16} color={Colors.status.danger} />
              <Text className="flex-1 text-[13px]" style={{ color: theme.text }}>
                {error}
              </Text>
            </View>
          ) : null}

          <View className="overflow-hidden rounded-2xl border" style={{ borderColor: theme.border }}>
            {entries.length === 0 ? (
              <View className="items-center py-10">
                {busy ? (
                  <ActivityIndicator color={theme.textSecondary} />
                ) : (
                  <Text style={{ color: theme.textSecondary }}>No courses</Text>
                )}
              </View>
            ) : (
              entries.map((entry, index) => {
                const expanded = expandedId === entry.courseId;
                const override = courseDefaults[entry.courseId];
                return (
                  <View
                    key={entry.courseId}
                    style={{
                      borderTopWidth: index === 0 ? 0 : 1,
                      borderTopColor: theme.border,
                    }}
                  >
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ expanded }}
                      onPress={() => setExpandedId(expanded ? null : entry.courseId)}
                      className="flex-row items-center gap-3 px-4 py-3"
                    >
                      <View className="flex-1 gap-0.5">
                        <Text
                          numberOfLines={1}
                          className="text-[15px] font-medium"
                          style={{ color: theme.text }}
                        >
                          {extractCourseName(entry.name)}
                        </Text>
                        <Text
                          numberOfLines={2}
                          className="text-[12px]"
                          style={{
                            color:
                              entry.status === "failed"
                                ? Colors.status.danger
                                : theme.textSecondary,
                          }}
                        >
                          {entry.status === "failed" || entry.message === "Interrupted"
                            ? (entry.message ?? extractCourseCode(entry.name))
                            : `${extractCourseCode(entry.name)}${override ? ` · Rating ${override.grade}` : ""}`}
                        </Text>
                      </View>
                      <StatusChip status={entry.status} theme={theme} />
                    </Pressable>
                    {expanded ? (
                      <View className="gap-3 px-4 pb-4">
                        <RatingPicker
                          allowDefault
                          value={override?.grade ?? null}
                          theme={theme}
                          onChange={(value) =>
                            value === null
                              ? clearCourseDefault(entry.courseId)
                              : setCourseDefault(entry.courseId, value, override?.textResponse ?? "")
                          }
                        />
                        {entry.status === "pending" || entry.status === "failed" ? (
                          <Pressable
                            disabled={busy}
                            onPress={() => setConfirmIds([entry.courseId])}
                            className="h-10 items-center justify-center rounded-xl border"
                            style={{ borderColor: theme.border, opacity: busy ? 0.5 : 1 }}
                          >
                            <Text className="text-[14px] font-semibold" style={{ color: theme.text }}>
                              {entry.status === "failed" ? "Retry" : "Submit"}
                            </Text>
                          </Pressable>
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                );
              })
            )}
          </View>

          {doneCount > 0 ? (
            <Text className="text-center text-[12px]" style={{ color: theme.textSecondary }}>
              {doneCount} of {entries.length} done
            </Text>
          ) : null}
        </KeyboardAwareScrollView>

        <View className="gap-2 px-4 pb-4 pt-2">
          {pendingIds.length > 0 && failedIds.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => setConfirmIds(failedIds)}
              className="h-11 items-center justify-center rounded-xl border"
              style={{ borderColor: theme.border, opacity: busy ? 0.5 : 1 }}
            >
              <Text className="text-[14px] font-semibold" style={{ color: theme.text }}>
                Retry failed ({failedIds.length})
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            disabled={busy || actionIds.length === 0}
            onPress={() => setConfirmIds(actionIds)}
            className="h-12 flex-row items-center justify-center gap-2 rounded-2xl"
            style={{
              backgroundColor: theme.text,
              opacity: busy || actionIds.length === 0 ? 0.4 : 1,
            }}
          >
            {activity === "submitting" || activity === "verifying" ? (
              <ActivityIndicator size="small" color={theme.background} />
            ) : null}
            <Text className="text-[15px] font-semibold" style={{ color: theme.background }}>
              {pendingIds.length > 0 ? `Submit all (${pendingIds.length})` : failedIds.length > 0 ? `Retry failed (${failedIds.length})` : "Nothing pending"}
            </Text>
          </Pressable>
        </View>
      </View>

      <ConfirmModal
        visible={confirmIds !== null}
        title={
          confirmIds?.length === 1
            ? `Submit ${extractCourseName(courses[confirmIds[0]]?.name ?? "feedback")}?`
            : `Submit ${confirmIds?.length ?? 0} feedback forms?`
        }
        message="Answers can't be changed on the LMS after submitting."
        confirmText="Submit"
        icon="send-outline"
        onCancel={() => setConfirmIds(null)}
        onConfirm={() => void runSubmit(confirmIds ?? [])}
      />
    </Container>
  );
}
