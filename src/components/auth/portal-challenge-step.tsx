import { AuthSubmitButton } from "@/components/auth/auth-submit-button";
import { CredentialForm } from "@/components/auth/credential-form";
import { Input } from "@/components/ui/input";
import type { AuthLoginRequest } from "@/types";
import { Text, View } from "react-native";

type ChallengeMode = Extract<
  AuthLoginRequest,
  { provider: "attendancePortal"; mode: "totp" | "emailOtp" | "backupCode" }
>["mode"];

interface PortalChallengeStepProps {
  mode: ChallengeMode;
  code: string;
  error: string | null;
  loading: boolean;
  onCodeChange: (code: string) => void;
  onSubmit: () => void;
  onUseBackupCode?: () => void;
}

export function PortalChallengeStep({
  mode,
  code,
  error,
  loading,
  onCodeChange,
  onSubmit,
  onUseBackupCode,
}: PortalChallengeStepProps) {
  const submit = (): void => {
    if (code.trim() && !loading) onSubmit();
  };

  return (
    <CredentialForm name="attendance-verification" onSubmit={submit}>
      <View className="gap-1">
        <Text className="text-xs font-semibold text-zinc-400">
          Verification
        </Text>
        <Text className="text-2xl font-bold text-zinc-50">
          {mode === "emailOtp" ? "Check your email" : "Enter your code"}
        </Text>
      </View>
      <Input
        label={mode === "backupCode" ? "Backup code" : "Verification code"}
        value={code}
        onChangeText={onCodeChange}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType={mode === "backupCode" ? "default" : "number-pad"}
        returnKeyType="go"
        onSubmitEditing={submit}
        autoComplete="one-time-code"
        webId="attendance-verification-code"
        webName="code"
        webRequired
      />
      {error ? <Text className="text-sm text-red-200">{error}</Text> : null}
      <AuthSubmitButton
        title="Verify"
        onPress={submit}
        loading={loading}
        disabled={!code.trim()}
      />
      {mode === "totp" && onUseBackupCode ? (
        <AuthSubmitButton
          title="Use a backup code"
          variant="ghost"
          onPress={onUseBackupCode}
        />
      ) : null}
    </CredentialForm>
  );
}
