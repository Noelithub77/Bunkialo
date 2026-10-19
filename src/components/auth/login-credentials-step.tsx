import { AuthSubmitButton } from "@/components/auth/auth-submit-button";
import { Input } from "@/components/ui/input";
import { CredentialForm } from "@/components/auth/credential-form";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

interface LoginCredentialsStepProps {
  accountLabel: string;
  identifier: string;
  identifierLabel: string;
  identifierType?: "default" | "email-address";
  password: string;
  error: string | null;
  loading: boolean;
  submitLabel: string;
  onIdentifierChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: () => void;
}

export function LoginCredentialsStep({
  accountLabel,
  identifier,
  identifierLabel,
  identifierType = "default",
  password,
  error,
  loading,
  submitLabel,
  onIdentifierChange,
  onPasswordChange,
  onSubmit,
}: LoginCredentialsStepProps) {
  const [showPassword, setShowPassword] = useState(false);
  const ready = Boolean(identifier.trim() && password);
  const submit = (): void => {
    if (ready && !loading) onSubmit();
  };
  const formName = accountLabel.toLowerCase().replaceAll(" ", "-");

  return (
    <CredentialForm name={`${formName}-login`} onSubmit={submit}>
      <View className="gap-2">
        {process.env.EXPO_OS !== "web" ? (
          <Text className="text-xs font-semibold text-zinc-400">
            {accountLabel}
          </Text>
        ) : null}
        <Text
          role="heading"
          aria-level={2}
          className={process.env.EXPO_OS === "web"
            ? "text-[28px] font-semibold tracking-[-0.8px] text-zinc-50"
            : "text-2xl font-bold text-zinc-50"}
        >
          {process.env.EXPO_OS === "web"
            ? accountLabel === "LMS"
              ? "Sign in to LMS"
              : "Connect attendance"
            : "Connect your account"}
        </Text>
        {process.env.EXPO_OS === "web" && accountLabel !== "LMS" ? (
          <Text className="text-sm leading-[22px] text-zinc-400">
            Use your institute attendance portal account.
          </Text>
        ) : null}
      </View>

      <View className="gap-3">
        <Input
          label={identifierLabel}
          value={identifier}
          onChangeText={onIdentifierChange}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType={identifierType}
          inputMode={identifierType === "email-address" ? "email" : "text"}
          returnKeyType="next"
          autoComplete="username"
          textContentType="username"
          webId={`${formName}-username`}
          webName="username"
          webRequired
        />
        <View>
          <Input
            label="Password"
            value={password}
            onChangeText={onPasswordChange}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="go"
            onSubmitEditing={submit}
            autoComplete="current-password"
            textContentType="password"
            webId={`${formName}-password`}
            webName="password"
            webRequired
            style={{ paddingRight: 52 }}
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => setShowPassword((visible) => !visible)}
            className="absolute right-3 top-8 h-9 w-9 items-center justify-center"
            accessibilityLabel={
              showPassword ? "Hide password" : "Show password"
            }
          >
            <MaterialCommunityIcons
              name={showPassword ? "eye-off-outline" : "eye-outline"}
              size={20}
              color="#A1A1AA"
            />
          </Pressable>
        </View>
      </View>

      {error ? (
        <Text accessibilityRole="alert" className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </Text>
      ) : null}

      <AuthSubmitButton
        title={submitLabel}
        onPress={submit}
        loading={loading}
        disabled={!ready}
      />
    </CredentialForm>
  );
}
