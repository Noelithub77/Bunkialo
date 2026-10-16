// A margin note beside each recording: a short handwritten line and an arrow toward the phone.
import { gsap } from "gsap";
import { drawOn, ink, Sketch } from "../sketch.ts";
import type { Build } from "./motion.ts";

export const build: Build = (svg, narrow) => {
  const text = svg.dataset.note ?? "";
  const toward = narrow ? "down" : svg.dataset.point === "left" ? "left" : "right";
  const s = new Sketch(svg, 300, 120, text.length * 7);
  const story = gsap.timeline({ paused: true });
  const lines = text.split("\n").length;
  const note = s.group(null, () => {
    if (toward === "down") {
      s.text(150, 30, text, { size: 21, color: ink.yellow });
      s.arrow([[150, 34 + lines * 25], [168, 78 + lines * 10], [150, 114]], { stroke: ink.yellow, width: 1.6 });
    } else {
      const left = toward === "left";
      s.text(left ? 296 : 4, 36, text, { size: 21, color: ink.yellow, anchor: left ? "end" : "start" });
      const y = 52 + lines * 22;
      s.arrow(left ? [[230, y], [150, y + 34], [30, y + 10]] : [[70, y], [150, y + 34], [270, y + 10]], { stroke: ink.yellow, width: 1.6 });
    }
  });
  drawOn(story, note, 0, 0.8);
  return { story };
};
