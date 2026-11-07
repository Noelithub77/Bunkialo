import { Linking } from "react-native";
import { router } from "expo-router";
import type { FabMenuItem } from "@/components/shared/fab-menu";

type LauncherItem = Pick<FabMenuItem, "key" | "label" | "icon"> & {
  route?: "/gpa" | "/more";
  url?: string;
};

const OUTPASS_URL = "https://outpass.iiitkottayam.ac.in/app";
const GATEPASS_URL = "https://gatepassstud.iiitkottayam.ac.in/index.php";
const FEASTON: LauncherItem = {
  key: "feaston",
  label: "Feaston",
  icon: "restaurant-outline",
  url: "https://feaston.iiitkottayam.ac.in/dashboard",
};

/** Top to bottom, so the last item sits closest to the button. */
function getLauncherLinks(username: string | null): LauncherItem[] {
  const isOldBatch = username?.startsWith("2022") || username?.startsWith("2023");
  const batchItems: LauncherItem[] = isOldBatch
    ? [
        { key: "outpass-rfid", label: "Outpass RFID", icon: "card-outline", url: OUTPASS_URL },
        { key: "outpass-fingerprint", label: "Outpass fingerprint", icon: "finger-print-outline", url: GATEPASS_URL },
        FEASTON,
      ]
    : [
        {
          key: "outpass",
          label: "Outpass",
          icon: "exit-outline",
          url: username?.startsWith("2024") ? GATEPASS_URL : OUTPASS_URL,
        },
        FEASTON,
        { key: "allpyq", label: "AllPYQ", icon: "book-outline", url: "https://allpyq.in" },
      ];

  return [
    { key: "more", label: "More", icon: "ellipsis-horizontal", route: "/more" },
    { key: "gpa", label: "GPA calculator", icon: "calculator-outline", route: "/gpa" },
    { key: "attendance", label: "Attendance", icon: "calendar-outline", url: "https://attendance.iiitkottayam.ac.in/" },
    ...batchItems,
  ];
}

export function getLauncherItems(username: string | null): FabMenuItem[] {
  return getLauncherLinks(username).map(({ route, url, ...item }) => ({
    ...item,
    opensExternally: Boolean(url),
    onPress: () => {
      if (route) router.push(route);
      else if (url) void Linking.openURL(url);
    },
  }));
}
