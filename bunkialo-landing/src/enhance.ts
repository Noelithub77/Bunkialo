// Motion layer, loaded after first paint: smooth scroll, text motion, and the hand-drawn scenes.
import { gsap } from "gsap";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { ScrambleTextPlugin } from "gsap/ScrambleTextPlugin";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import Lenis from "lenis";
import { budget } from "./bunk-math.ts";
import { mountPrompt } from "./prompt.ts";
import { build as agent } from "./scenes/agent.ts";
import { build as bunks } from "./scenes/bunks.ts";
import type { Build, Scene } from "./scenes/motion.ts";
import { build as name } from "./scenes/name.ts";
import { build as note } from "./scenes/note.ts";
import { build as portals } from "./scenes/portals.ts";
import { build as star } from "./scenes/star.ts";
import { build as wifix } from "./scenes/wifix.ts";

gsap.registerPlugin(ScrollTrigger, SplitText, DrawSVGPlugin, ScrambleTextPlugin);

const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
const builders: Record<string, Build> = { name, bunks, portals, wifix, agent, note, star };
// Story scenes follow the scroll; the rest play once they come into view.
const scrubbed = new Set(["name", "wifix"]);
const scenes = new Map<string, Scene>();

if (!calm) {
  const lenis = new Lenis({ autoRaf: false, lerp: 0.12, anchors: { offset: -72 } });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

// Header state and reading progress.
const bar = document.querySelector(".bar");
const progress = document.querySelector(".bar-progress");
ScrollTrigger.create({
  start: 0,
  end: "max",
  onUpdate: (self) => {
    bar?.classList.toggle("is-scrolled", self.scroll() > 8);
    document.body.classList.toggle("is-scrolled-past", self.scroll() > 80);
    if (progress) gsap.set(progress, { scaleX: self.progress });
  },
});

// Hero: the name flips, letter by letter, into what it means.
const morph = document.querySelector<HTMLElement>("[data-morph]");
const nameWord = morph?.querySelector(".name");
const phrase = morph?.querySelector(".phrase");
if (!calm && morph && nameWord && phrase) {
  const a = SplitText.create(nameWord, { type: "chars" }).chars;
  const b = SplitText.create(phrase, { type: "chars" }).chars;
  gsap.set(phrase, { opacity: 1 });
  const hidden = { yPercent: 40, rotationX: -70, opacity: 0, filter: "blur(4px)" };
  const shown = { yPercent: 0, rotationX: 0, opacity: 1, filter: "blur(0px)" };
  gsap.set(b, hidden);
  const out = { yPercent: -40, rotationX: 70, opacity: 0, filter: "blur(4px)", duration: 0.32, stagger: 0.025, ease: "power2.in" };
  const into = { ...shown, duration: 0.5, stagger: 0.025, ease: "power3.out", immediateRender: false };
  const cycle = gsap
    .timeline({ repeat: -1, delay: 1.6, repeatDelay: 0.4 })
    .to(a, out, 2.2)
    .fromTo(b, hidden, into, 2.45)
    .to(b, out, 5.4)
    .fromTo(a, hidden, into, 5.7);
  ScrollTrigger.create({ trigger: ".hero", start: "top top", end: "bottom top", onToggle: (self) => void (self.isActive ? cycle.resume() : cycle.pause()) });
}

if (!calm) {
  // Only hide what is still below the fold, so nothing visible blinks out.
  const below = gsap.utils.toArray<HTMLElement>("[data-reveal]").filter((element) => element.getBoundingClientRect().top > innerHeight);
  gsap.set(below, { opacity: 0, y: 28 });
  ScrollTrigger.batch(below, { start: "top 88%", once: true, onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: 1, ease: "expo.out", stagger: 0.08 }) });
  for (const heading of document.querySelectorAll(".section-head h2, .final h2, .star-card h2")) {
    SplitText.create(heading, {
      type: "lines",
      mask: "lines",
      autoSplit: true,
      onSplit: (self) => gsap.from(self.lines, { yPercent: 105, duration: 1, stagger: 0.09, ease: "power4.out", scrollTrigger: { trigger: heading, start: "top 88%", once: true } }),
    });
  }
  // Kicker numbers scramble in, like a counter settling.
  for (const number of document.querySelectorAll<HTMLElement>(".kicker span")) {
    const value = number.textContent ?? "";
    gsap.to(number, { duration: 0.9, scrambleText: { text: value, chars: "0123456789", speed: 0.6 }, scrollTrigger: { trigger: number, start: "top 90%", once: true } });
  }
}

function markSteps(key: string, story: gsap.core.Timeline) {
  const steps = document.querySelectorAll(`[data-story="${key}"] li`);
  if (!steps.length) return;
  let active = 0;
  for (const [label, time] of Object.entries(story.labels)) {
    if (label.startsWith("step") && story.time() >= time - 0.01) active = Number(label.slice(4));
  }
  steps.forEach((step, i) => step.classList.toggle("is-active", i === active));
}

/** Builds one scene and drives it: scrubbed, pinned, or played on view. */
function mount(element: Element, narrow: boolean, pin: boolean) {
  const key = element.getAttribute("data-scene") ?? "";
  const svg = element instanceof SVGSVGElement ? element : element.querySelector("svg");
  const build = builders[key];
  if (!svg || !build) return;
  const scene = build(svg, narrow);
  scenes.set(key, scene);
  let inView = false;
  let finished = false;
  const sync = () => {
    const live = inView && finished && !calm;
    svg.classList.toggle("is-live", live);
    if (live) scene.loop?.play();
    else scene.loop?.pause();
  };
  ScrollTrigger.create({ trigger: element, start: "top bottom", end: "bottom top", onToggle: (self) => void ((inView = self.isActive), sync()) });
  if (calm) {
    scene.story.progress(1);
    markSteps(key, scene.story);
    return;
  }
  if (!scrubbed.has(key)) {
    scene.story.eventCallback("onComplete", () => void ((finished = true), sync()));
    ScrollTrigger.create({ trigger: element, start: "top 78%", once: true, onEnter: () => void scene.story.play() });
    return;
  }
  // The story follows the scroll with a little lag, so scrubbing stays smooth.
  const follow = {
    animation: scene.story,
    scrub: 0.5,
    onUpdate: () => {
      finished = scene.story.progress() > 0.98;
      markSteps(key, scene.story);
      sync();
    },
  };
  const section = element.closest("section");
  if (pin && section) {
    ScrollTrigger.create({ trigger: section.querySelector(".pin") ?? section, start: "center center", end: "+=150%", pin: true, ...follow });
  } else {
    ScrollTrigger.create({ trigger: element, start: "top 80%", end: "bottom 55%", ...follow });
  }
}

// Excalifont must be ready before scenes measure their handwriting.
void document.fonts.load("20px Excalifont").then(() => {
  const media = gsap.matchMedia();
  media.add({ narrow: "(max-width: 960px)", tall: "(min-height: 760px)" }, (context) => {
    const narrow = context.conditions?.narrow ?? false;
    const tall = context.conditions?.tall ?? false;
    scenes.clear();
    for (const element of document.querySelectorAll("[data-scene]")) {
      mount(element, narrow, !narrow && tall && Boolean(element.closest("[data-pin-section]")));
    }
  });
  ScrollTrigger.refresh();
});

// Credits under the bunk scene redraw the budget.
let credits = 3;
const creditCount = document.querySelector("[data-credit-count]");
const creditBudget = document.querySelector("[data-credit-budget]");
const less = document.querySelector<HTMLButtonElement>('[data-credits="-1"]');
const more = document.querySelector<HTMLButtonElement>('[data-credits="1"]');
document.addEventListener("click", (event) => {
  const step = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-credits]") : null;
  if (!step) return;
  credits = Math.min(4, Math.max(1, credits + Number(step.dataset.credits)));
  if (creditCount) creditCount.textContent = String(credits);
  if (creditBudget) creditBudget.textContent = String(budget(credits));
  if (less) less.disabled = credits === 1;
  if (more) more.disabled = credits === 4;
  scenes.get("bunks")?.act?.(String(credits));
});

// The agent prompt types while it is on screen.
const promptBox = document.querySelector<HTMLElement>("[data-prompt]");
if (promptBox) {
  const prompt = mountPrompt(promptBox, calm);
  ScrollTrigger.create({ trigger: promptBox, start: "top 80%", end: "bottom top", onToggle: (self) => (self.isActive ? prompt.play() : prompt.pause()) });
}

// The closing mark tosses its cap, like a graduation.
const finalCap = document.querySelector(".final-logo .cap");
if (!calm && finalCap) {
  const toss = gsap.timeline({ paused: true });
  toss.to(finalCap, { y: -150, rotation: 340, duration: 0.6, ease: "power2.out" }).to(finalCap, { y: 0, rotation: 360, duration: 0.7, ease: "bounce.out" }).set(finalCap, { rotation: 0 });
  ScrollTrigger.create({ trigger: ".final", start: "top 70%", onEnter: () => void toss.restart() });
  document.querySelector(".final-logo")?.addEventListener("click", () => void toss.restart());
}

// A soft spotlight follows the pointer across cards.
document.addEventListener(
  "pointermove",
  (event) => {
    const card = event.target instanceof Element ? event.target.closest<HTMLElement>(".trio article, .prompt, .star-card") : null;
    if (!card) return;
    const box = card.getBoundingClientRect();
    card.style.setProperty("--mx", `${event.clientX - box.left}px`);
    card.style.setProperty("--my", `${event.clientY - box.top}px`);
  },
  { passive: true },
);

// Type "bunk" anywhere and Bunkialo asks the question back.
let typed = "";
document.addEventListener("keydown", (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey || event.key.length !== 1) return;
  if (event.target instanceof Element && event.target.closest("input, textarea, [contenteditable]")) return;
  typed = (typed + event.key.toLowerCase()).slice(-4);
  if (typed !== "bunk") return;
  typed = "";
  const toast = document.createElement("p");
  toast.className = "toast";
  toast.textContent = "Bunk cheythalo? Only if you have bunks left.";
  document.body.append(toast);
  gsap.fromTo(toast, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "power3.out", onComplete: () => void gsap.to(toast, { opacity: 0, y: 10, delay: 2.4, duration: 0.4, onComplete: () => toast.remove() }) });
});

void document.fonts.ready.then(() => ScrollTrigger.refresh());
