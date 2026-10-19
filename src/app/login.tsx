import { scheduleDeferredTask } from "@/utils/scheduling";
import { LoginLayout } from "@/components/auth/login-layout";
import { LoginCredentialsStep } from "@/components/auth/login-credentials-step";
import { PortalChallengeStep } from "@/components/auth/portal-challenge-step";
import { login } from "@/services/auth/login";
import {
  ATTENDANCE_PORTAL_URL,
  checkAttendanceSession,
} from "@/services/auth/attendance-auth";
import { getAttendanceCredentials } from "@/services/auth/secure-auth-storage";
import { getWebCredential } from "@/services/auth/web-password-manager.web";
import { DESKTOP_PAIRING_ROUTE } from "@/services/desktop-pairing";
import { useAuthStore } from "@/stores/auth-store";
import type { AuthLoginRequest } from "@/types";
import * as Device from "expo-device";
import { Component, Suspense, lazy, useEffect, useState } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { StatusBar } from "expo-status-bar";
import { router, useGlobalSearchParams } from "expo-router";
import {
  Linking,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";

type ChallengeRequest = Extract<
  AuthLoginRequest,
  { provider: "attendancePortal"; mode: "totp" | "emailOtp" | "backupCode" }
>;

type LoginBackgroundMode = "waiting" | "animated" | "static" | "fallback";

const DeferredGrainyGradient = lazy(
  () => import("@/components/shared/ui/organisms/grainy-gradient"),
);

interface LoginBackgroundErrorBoundaryProps {
  children: ReactNode;
  onFallback: () => void;
}

interface LoginBackgroundErrorBoundaryState {
  hasError: boolean;
}

class LoginBackgroundErrorBoundary extends Component<
  LoginBackgroundErrorBoundaryProps,
  LoginBackgroundErrorBoundaryState
> {
  state: LoginBackgroundErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): LoginBackgroundErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(
      "Login background animation failed; using static background.",
      {
        error,
        componentStack: info.componentStack,
      },
    );
    this.props.onFallback();
  }

  render(): ReactNode {
    return this.state.hasError ? null : this.props.children;
  }
}

export default function LoginScreen() {
  const [step, setStep] = useState<"lms" | "attendance">("lms");
  const [rollNumber, setRollNumber] = useState("");
  const [lmsPassword, setLmsPassword] = useState("");
  const [email, setEmail] = useState("");
  const [portalPassword, setPortalPassword] = useState("");
  const [challenge, setChallenge] = useState<ChallengeRequest | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const canAttemptLoginAnimation =
    Platform.OS === "web" ||
    (Device.deviceYearClass !== null && Device.deviceYearClass >= 2020);
  const [backgroundMode, setBackgroundMode] = useState<LoginBackgroundMode>(
    canAttemptLoginAnimation ? "waiting" : "static",
  );
  const completeLogin = useAuthStore((state) => state.completeLogin);
  const params = useGlobalSearchParams<{ returnTo?: string }>();

  useEffect(() => {
    if (!canAttemptLoginAnimation) return;

    let startTimer: ReturnType<typeof setTimeout> | undefined;
    const interactionTask = scheduleDeferredTask(() => {
      startTimer = setTimeout(() => setBackgroundMode("animated"), 1200);
    });

    return () => {
      interactionTask.cancel();
      if (startTimer) clearTimeout(startTimer);
    };
  }, [canAttemptLoginAnimation]);

  const finishLogin = (username: string): void => {
    completeLogin(username);
    if (params.returnTo === DESKTOP_PAIRING_ROUTE) {
      router.replace(DESKTOP_PAIRING_ROUTE as never);
    }
  };

  useEffect(() => {
    if (process.env.EXPO_OS !== "web") return;
    let active = true;
    void getWebCredential()
      .then((credential) => {
        if (!active || !credential) return;
        setRollNumber(credential.identifier);
        setLmsPassword(credential.password);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setError(
          error instanceof Error
            ? error.message
            : "Could not restore the saved sign-in.",
        );
      });
    return () => {
      active = false;
    };
  }, []);

  const submitLms = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const result = await login({
        provider: "lms",
        mode: "password",
        username: rollNumber.trim(),
        password: lmsPassword,
      });
      if (result.status === "success") {
        const attendanceCredentials = await getAttendanceCredentials();
        if (attendanceCredentials) {
          void checkAttendanceSession().catch((error: unknown) => {
            console.error(
              "Could not verify the saved attendance session.",
              error,
            );
          });
          completeLogin(rollNumber.trim());
          return;
        }
        setStep("attendance");
        return;
      }
      if (result.status === "failure") setError(result.message);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not sign in.");
    } finally {
      setLoading(false);
    }
  };

  const handlePortalResult = (
    result: Awaited<ReturnType<typeof login>>,
  ): void => {
    if (result.status === "success") {
      finishLogin(rollNumber.trim());
      return;
    }
    if (result.status === "challenge") {
      setChallenge({
        provider: "attendancePortal",
        mode: result.challenge,
        intermediate: result.intermediate,
        code: "",
      });
      return;
    }
    setError(result.message);
  };

  const submitPortal = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const result = await login({
        provider: "attendancePortal",
        mode: "password",
        email: email.trim(),
        password: portalPassword,
      });
      handlePortalResult(result);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not sign in.");
    } finally {
      setLoading(false);
    }
  };

  const submitChallenge = async (): Promise<void> => {
    if (!challenge) return;
    setLoading(true);
    setError(null);
    try {
      const result = await login({ ...challenge, code: code.trim() });
      handlePortalResult(result);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not verify the code.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-black">
      <StatusBar style="light" />
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: "#111113" }]}
      >
        {backgroundMode === "animated" ? (
          <LoginBackgroundErrorBoundary
            key="animated-background"
            onFallback={() => setBackgroundMode("fallback")}
          >
            <Suspense fallback={null}>
              <DeferredGrainyGradient
                colors={["#111113", "#1B1B20", "#26262C", "#16161A"]}
                speed={1.8}
                intensity={0.08}
                size={1.6}
                amplitude={0.08}
                brightness={0.01}
                resolutionScale={0.18}
                settleMs={1400}
                style={StyleSheet.absoluteFill}
              />
            </Suspense>
          </LoginBackgroundErrorBoundary>
        ) : null}
      </View>
      <View className="absolute inset-0 bg-black/35" />
      <LoginLayout
        step={step}
        showNavigation={step === "attendance" && !challenge}
        onBack={() => {
          setError(null);
          setStep("lms");
        }}
        onOpenPortal={() =>
          void Linking.openURL(`${ATTENDANCE_PORTAL_URL}/login`)
        }
        backgroundNotice={
          backgroundMode === "static" ? (
            <Text className="text-center text-xs text-zinc-600">
              Animated background is off on older or unclassified devices to
              keep sign-in reliable.
            </Text>
          ) : backgroundMode === "fallback" ? (
            <Text
              accessibilityLiveRegion="polite"
              className="text-center text-xs text-zinc-600"
            >
              Background animation was turned off; sign-in is unaffected.
            </Text>
          ) : null
        }
      >
        {step === "lms" ? (
          <LoginCredentialsStep
            accountLabel="LMS"
            identifier={rollNumber}
            identifierLabel="Roll number"
            password={lmsPassword}
            error={error}
            loading={loading}
            submitLabel="Continue"
            onIdentifierChange={setRollNumber}
            onPasswordChange={setLmsPassword}
            onSubmit={() => void submitLms()}
          />
        ) : challenge ? (
          <PortalChallengeStep
            mode={challenge.mode}
            code={code}
            error={error}
            loading={loading}
            onCodeChange={setCode}
            onSubmit={() => void submitChallenge()}
            onUseBackupCode={() =>
              setChallenge({ ...challenge, mode: "backupCode" })
            }
          />
        ) : (
          <LoginCredentialsStep
            accountLabel="Attendance portal"
            identifier={email}
            identifierLabel="Institute email"
            identifierType="email-address"
            password={portalPassword}
            error={error}
            loading={loading}
            submitLabel="Finish sign in"
            onIdentifierChange={setEmail}
            onPasswordChange={setPortalPassword}
            onSubmit={() => void submitPortal()}
          />
        )}
      </LoginLayout>
    </View>
  );
}
