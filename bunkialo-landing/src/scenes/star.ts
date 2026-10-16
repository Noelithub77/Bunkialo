// A hand-drawn star with a thank-you, for the GitHub note.
import { gsap } from "gsap";
import { drawOn, ink, type Point, Sketch } from "../sketch.ts";
import type { Build } from "./motion.ts";

export const build: Build = (svg) => {
  const s = new Sketch(svg, 220, 220, 13);
  const story = gsap.timeline({ paused: true });
  const points: Point[] = Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 ? 34 : 78;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    return [110 + r * Math.cos(a), 100 + r * Math.sin(a)];
  });
  const star = s.group(null, () => s.polygon(points, { stroke: ink.yellow, fill: ink.yellowFill, width: 2.6 }));
  const thanks = s.text(110, 212, "thank you!", { size: 22, color: ink.yellow });
  drawOn(story, star, 0, 1);
  drawOn(story, thanks, ">-0.2", 0.5);
  return { story };
};
