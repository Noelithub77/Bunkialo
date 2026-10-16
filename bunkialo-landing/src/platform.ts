export const links = {
  play: "https://play.google.com/store/apps/details?id=com.codialo.Bunkialo2",
  web: "https://bunkialo.allpyq.in",
  github: "https://github.com/Noelithub77/bunkialo2",
  upi: "upi://pay?pa=noelmcv7@oksbi&pn=Noel%20Georgi&tn=Support%20Bunkialo&cu=INR",
} as const;

export type Device = "android" | "ios" | "desktop";

/** Android phones get the Play Store app; everything else, including iPadOS reporting a Mac, gets the web app. */
export function detectDevice(platform: string, userAgent: string, touchPoints = 0): Device {
  const text = `${platform} ${userAgent}`;
  if (/android/i.test(text)) return "android";
  if (/iphone|ipad|ipod/i.test(text) || (/mac/i.test(text) && touchPoints > 1)) return "ios";
  return "desktop";
}

type Get = { href: string; label: string; other: { href: string; label: string }; note: string };

export function getFor(device: Device): Get {
  if (device === "android") {
    return { href: links.play, label: "Get it on Google Play", other: { href: links.web, label: "or open the web app" }, note: "Free on Android. Also on Wear OS." };
  }
  return {
    href: links.web,
    label: "Open the web app",
    other: { href: links.play, label: "or get the Android app" },
    note: device === "ios" ? "In Safari, tap Share, then Add to Home Screen." : "Works in any browser. Install it as an app from the address bar.",
  };
}
