import "./style.css";
import { detectDevice, getFor } from "./platform.ts";

const device = detectDevice(navigator.platform, navigator.userAgent, navigator.maxTouchPoints);
const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;

// Android gets the Play Store; every other device gets the web app.
const get = getFor(device);
for (const block of document.querySelectorAll("[data-get]")) {
  const cta = block.querySelector<HTMLAnchorElement>("[data-cta]");
  const label = block.querySelector("[data-cta-label]");
  const other = block.querySelector<HTMLAnchorElement>("[data-other]");
  if (cta) cta.href = get.href;
  if (label) label.textContent = get.label;
  if (other) {
    other.href = get.other.href;
    other.textContent = get.other.label;
  }
}
const note = document.querySelector("[data-note]");
if (note) note.textContent = get.note;

// Recordings load only near the viewport and play only while visible.
const sources = (name: string) =>
  `<source src="/media/${name}.webm" type='video/webm; codecs="av01.0.05M.08"' /><source src="/media/${name}.mp4" type="video/mp4" />`;
const near = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const figure = entry.target as HTMLElement;
      const video = figure.querySelector("video");
      if (!video) continue;
      near.unobserve(figure);
      video.innerHTML = sources(figure.dataset.video ?? "");
      video.addEventListener("playing", () => figure.classList.add("is-playing"), { once: true });
      video.load();
      visible.observe(figure);
    }
  },
  { rootMargin: "600px 0px" },
);
const visible = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      const video = entry.target.querySelector("video");
      if (!video || calm) continue;
      if (entry.isIntersecting) void video.play().catch(() => undefined);
      else video.pause();
    }
  },
  { threshold: 0.35 },
);
for (const figure of document.querySelectorAll("[data-video]")) near.observe(figure);

// With reduced motion, recordings wait for a tap.
if (calm) {
  document.addEventListener("click", (event) => {
    const video = event.target instanceof Element ? event.target.closest("[data-video]")?.querySelector("video") : null;
    if (!video) return;
    if (video.paused) void video.play();
    else video.pause();
  });
}

// Install commands: copy, and the CLI's Windows variant.
const unix = "curl -fsSL https://raw.githubusercontent.com/Noelithub77/bunkialo2/main/cli/install.sh | sh";
const windows = "irm https://raw.githubusercontent.com/Noelithub77/bunkialo2/main/cli/install.ps1 | iex";
const installCmd = document.querySelector("[data-install-cmd]");
const installSwap = document.querySelector("[data-install-swap]");
const showInstall = (onWindows: boolean) => {
  if (installCmd) installCmd.textContent = onWindows ? windows : unix;
  if (installSwap) installSwap.textContent = onWindows ? "On macOS or Linux?" : "On Windows?";
};
showInstall(/win/i.test(navigator.platform));

const coffee = document.querySelector<HTMLDialogElement>("[data-coffee-dialog]");
document.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target : null;
  const copy = target?.closest<HTMLButtonElement>("[data-copy]");
  const text = copy?.parentElement?.querySelector("code")?.textContent;
  if (copy && text) {
    void navigator.clipboard.writeText(text).then(() => {
      copy.textContent = "Copied";
      setTimeout(() => (copy.textContent = "Copy"), 1600);
    });
  }
  if (target?.closest("[data-install-swap]")) showInstall(installCmd?.textContent === unix);
  // Phones open the UPI app directly; desktops show the QR code.
  if (target?.closest("[data-coffee]") && device === "desktop" && coffee) {
    event.preventDefault();
    coffee.showModal();
  }
});
coffee?.addEventListener("click", (event) => {
  if (event.target === coffee) coffee.close();
});

// Let the hero paint before requesting the motion libraries.
const idle = (callback: () => void) => ("requestIdleCallback" in window ? requestIdleCallback(callback, { timeout: 1500 }) : setTimeout(callback, 120));
requestAnimationFrame(() => idle(() => void import("./enhance.ts")));
