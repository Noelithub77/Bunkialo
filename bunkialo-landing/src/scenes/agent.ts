// An agent learns the portals from the skill and works them through the CLI.
import { gsap } from "gsap";
import { box, person } from "../icons.ts";
import { type Arrow, drawOn, ink, type Point, Sketch } from "../sketch.ts";
import { type Build, stream } from "./motion.ts";

const portals = ["Moodle LMS", "attendance portal", "campus Wi‑Fi"];

export const build: Build = (svg, narrow) => {
  const s = new Sketch(svg, narrow ? 420 : 1100, narrow ? 680 : 300, 61);
  const story = gsap.timeline({ paused: true });
  const loop = gsap.timeline({ paused: true });
  const at = (wide: Point, tall: Point): Point => (narrow ? tall : wide);
  const you = at([80, 130], [80, 100]);
  const agent = at([330, 150], [270, 110]);
  const skill = at([600, 95], [106, 316]);
  const cli = at([600, 205], [314, 316]);
  const portalSpots: Point[] = portals.map((_, i) => at([930, 60 + i * 90], [150, 480 + i * 66]));
  const size = narrow ? 16 : 19;

  const people = s.group(null, () => {
    person(s, you[0], you[1], 24);
    s.text(you[0], you[1] + 92, "you", { size: 18, color: ink.soft });
  });
  const ask = s.arrow(narrow ? [[you[0] + 40, you[1] - 6], [agent[0] - 100, agent[1] - 4]] : [[you[0] + 44, you[1]], [agent[0] - 118, agent[1]]], { stroke: ink.line, width: 1.6 });
  const brain = s.group(null, () => box(s, agent[0], agent[1], narrow ? 190 : 220, 70, "your agent", { stroke: ink.line, fill: ink.greyFill }, 21));
  const tools = s.group(null, () => {
    box(s, skill[0], skill[1], narrow ? 196 : 220, 62, "skill:\nhow the portals work", { stroke: ink.yellow }, size);
    box(s, cli[0], cli[1], narrow ? 196 : 220, 62, "bunkialo CLI:\ndoes the work", { stroke: ink.yellow, fill: ink.yellowFill }, size);
  });
  const links: Arrow[] = [
    s.arrow(narrow ? [[agent[0] - 40, agent[1] + 40], [skill[0], skill[1] - 36]] : [[agent[0] + 114, agent[1] - 14], [skill[0] - 114, skill[1]]], { stroke: ink.soft, width: 1.4 }),
    s.arrow(narrow ? [[agent[0] + 20, agent[1] + 40], [cli[0], cli[1] - 36]] : [[agent[0] + 114, agent[1] + 14], [cli[0] - 114, cli[1]]], { stroke: ink.soft, width: 1.4 }),
  ];
  // Narrow: the CLI's calls run down the right side and turn into each portal.
  const outs: Arrow[] = portalSpots.map(([x, y]) =>
    s.arrow(narrow ? [[cli[0] + 20, cli[1] + 36], [cli[0] + 30, y - 24], [x + 108, y]] : [[cli[0] + 114, cli[1] + (y - cli[1]) * 0.15], [x - 100, y]], { stroke: ink.yellow, width: 1.6 }),
  );
  const ends = s.group(null, () => {
    portals.forEach((label, i) => box(s, portalSpots[i][0], portalSpots[i][1], narrow ? 200 : 190, 50, label, { stroke: ink.soft }, size));
  });
  const reply = s.group(null, () => {
    const from: Point = narrow ? [agent[0] - 60, agent[1] - 42] : [agent[0] - 30, agent[1] + 40];
    const to: Point = narrow ? [you[0] + 30, you[1] - 34] : [you[0] + 30, you[1] + 66];
    s.arrow([from, narrow ? [from[0] - 50, from[1] - 28] : [from[0] - 110, to[1] + 30], to], { stroke: ink.green, width: 1.6, dash: true });
    s.text(narrow ? 160 : 210, narrow ? 34 : you[1] + 128, "a real answer", { size: 17, color: ink.green });
  });

  story.addLabel("step0", 0);
  drawOn(story, people, "step0", 0.5);
  drawOn(story, [ask.group, brain], ">-0.1", 0.6);
  drawOn(story, links.map((a) => a.group), ">-0.1", 0.5);
  drawOn(story, tools, ">-0.2", 0.6);
  drawOn(story, outs.map((a) => a.group), ">-0.1", 0.6);
  drawOn(story, ends, ">-0.2", 0.6);
  drawOn(story, reply, ">", 0.6);

  outs.forEach((arrow) => stream(loop, s, arrow.guide, ink.yellow, 2, 2.2, 4));
  stream(loop, s, ask.guide, ink.line, 1, 2.8, 4);
  return { story, loop };
};
