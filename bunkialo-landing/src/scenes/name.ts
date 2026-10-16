import { gsap } from "gsap";
import { scribble } from "../icons.ts";
import { drawOn, ink, Sketch } from "../sketch.ts";
import type { Build } from "./motion.ts";

export const build: Build = (svg) => {
  const s = new Sketch(svg, 520, 240, 23);
  const story = gsap.timeline({ paused: true });

  const words = s.group(null, () => {
    s.text(130, 45, "bunk", { size: 40, color: ink.yellow });
    s.text(222, 45, "+", { size: 32, color: ink.soft });
    s.text(365, 45, "cheythalo", { size: 40 });
    s.text(260, 82, "Malayalam: “shall we bunk?”", { size: 19, color: ink.soft });
  });
  const name = s.group(null, () => {
    s.arrow([[260, 100], [252, 120], [260, 140]], { stroke: ink.soft, width: 1.6 });
    s.text(260, 202, "Bunkialo", { size: 56 });
    scribble(s, [148, 222], [372, 220], { stroke: ink.yellow });
  });

  drawOn(story, words, 0, 0.6);
  drawOn(story, name, ">", 0.6);
  return { story };
};
