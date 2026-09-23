import { useWifixLogStore } from "@/stores/wifix-log-store";
import { useDashboardStore } from "@/stores/dashboard-store";
import type { DashboardLog } from "@/types";

export interface WifixFailureSummary {
  title: string;
  detail: string;
  rawMessage: string;
}

export const summarizeWifixFailure = (error: unknown): WifixFailureSummary => {
  const rawMessage =
    error instanceof Error && error.message
      ? error.message
      : typeof error === "string" && error.length > 0
        ? error
        : "Unknown WiFix error";

  if (/Binding socket to network .* failed: EPERM/i.test(rawMessage)) {
    return {
      title: "Android denied Wi-Fi socket binding",
      detail: "Failed step: bind the DNS socket to Wi-Fi (EPERM).",
      rawMessage,
    };
  }

  return {
    title: "WiFix request failed",
    detail: "Failed step could not be identified. See Settings > Developer > Logs.",
    rawMessage,
  };
};

export const wifixLogger = {
  log: (message: string, type: DashboardLog["type"] = "info") => {
    try {
      const store = useWifixLogStore.getState();
      store.addLog(message, type);
    } catch (error) {
      console.debug("Wifix logging not available:", error);
    }
  },

  info: (message: string) => wifixLogger.log(message, "info"),
  success: (message: string) => wifixLogger.log(message, "success"),
  error: (message: string) => {
    wifixLogger.log(message, "error");
    try {
      useDashboardStore.getState().addLog(message, "error");
    } catch (error) {
      console.debug("WiFix settings logging not available:", error);
    }
  },
};
