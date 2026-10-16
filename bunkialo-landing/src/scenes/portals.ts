// Every campus source flows into one app, and comes out as the few things a student needs today.
import { gsap } from "gsap";
import { box, phone } from "../icons.ts";
import { type Arrow, drawOn, ink, type Point, Sketch } from "../sketch.ts";
import { type Build, stream } from "./motion.ts";

const sources = ["Moodle LMS", "attendance portal", "academic calendar", "mess menu", "faculty list"];
const outputs = ["what's next", "bunks left", "timetable", "reminders"];

export const build: Build = (svg, narrow) => {
  const s = new Sketch(svg, narrow ? 420 : 1150, narrow ? 780 : 560, 53);
  const story = gsap.timeline({ paused: true });
  const loop = gsap.timeline({ paused: true });
  const hub: Point = narrow ? [322, 200] : [575, 270];
  const hubH = narrow ? 190 : 250;
  const hubW = hubH * 0.52;
  const size = { w: narrow ? 176 : 210, h: narrow ? 50 : 56 };
  const text = narrow ? 17 : 20;

  // Narrow: sources stack on the left, feed the app on the right, and results stack back on the left.
  const inSpots: Point[] = sources.map((_, i): Point => (narrow ? [104, 60 + i * 70] : [150, 70 + i * 100]));
  const outSpots: Point[] = outputs.map((_, i): Point => (narrow ? [104, 450 + i * 66] : [1000, 100 + i * 112]));

  const inputs = s.group(null, () => {
    sources.forEach((label, i) => box(s, inSpots[i][0], inSpots[i][1], size.w, size.h, label, { stroke: ink.soft }, text));
  });

  const center = s.group(null, () => {
    phone(s, hub[0], hub[1], hubH, { stroke: ink.yellow });
    s.circle(hub[0], hub[1] - hubH * 0.12, hubW * 0.42, { stroke: "none", fill: ink.yellow, rough: 0.4 });
    s.text(hub[0], hub[1] - hubH * 0.12 + 9, "B", { size: hubW * 0.26, color: ink.bg });
    s.text(hub[0], hub[1] + hubH * 0.22, "Bunkialo", { size: narrow ? 18 : 22, color: ink.yellow });
  });

  const inArrows: Arrow[] = inSpots.map(([x, y]) => {
    const from: Point = [x + size.w / 2 + 6, y];
    const to: Point = [hub[0] - hubW / 2 - 10, hub[1] + (y - hub[1]) * 0.3];
    const bend: Point = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2 + (narrow ? 0 : (y - hub[1]) * 0.12)];
    return s.arrow([from, bend, to], { stroke: ink.soft, width: 1.4 });
  });

  const results = s.group(null, () => {
    outputs.forEach((label, i) => box(s, outSpots[i][0], outSpots[i][1], size.w * 0.86, size.h, label, { stroke: ink.yellow, fill: ink.yellowFill }, text));
  });

  const outArrows: Arrow[] = outSpots.map(([x, y]) => {
    const from: Point = narrow ? [hub[0], hub[1] + hubH / 2 + 8] : [hub[0] + hubW / 2 + 10, hub[1] + (y - hub[1]) * 0.3];
    const to: Point = narrow ? [x + (size.w * 0.86) / 2 + 8, y] : [x - (size.w * 0.86) / 2 - 8, y];
    const bend: Point = narrow ? [from[0] - 10, (from[1] + to[1]) / 2 + 20] : [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
    return s.arrow([from, bend, to], { stroke: ink.yellow, width: 1.6 });
  });

  const shortcuts = s.group(null, () => {
    const y = narrow ? 740 : 500;
    s.text(narrow ? 210 : hub[0], y, "one tap away: Outpass · Feaston · AllPYQ", { size: narrow ? 16 : 19, color: ink.soft });
    if (!narrow) s.arrow([[hub[0], hub[1] + hubH / 2 + 8], [hub[0], y - 26]], { stroke: ink.soft, dash: true, width: 1.4 });
  });

  story.addLabel("step0", 0);
  drawOn(story, inputs, "step0", 0.9);
  drawOn(story, inArrows.map((a) => a.group), ">-0.3", 0.7);
  drawOn(story, center, ">-0.2", 0.7);
  drawOn(story, outArrows.map((a) => a.group), ">-0.1", 0.6);
  drawOn(story, results, ">-0.2", 0.7);
  drawOn(story, shortcuts, ">", 0.5);

  inArrows.forEach((arrow, i) => stream(loop, s, arrow.guide, ink.line, 2, 2.6 + i * 0.2, 4));
  outArrows.forEach((arrow) => stream(loop, s, arrow.guide, ink.yellow, 2, 2.2, 4.5));
  return { story, loop };
};
