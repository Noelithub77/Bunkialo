// The two numbers on every course card: the semester's bunk budget, and the buffer above 80%.
import { gsap } from "gsap";
import { cross } from "../icons.ts";
import { drawOn, ink, type Point, Sketch } from "../sketch.ts";
import { budget, buffer } from "../bunk-math.ts";
import type { Build } from "./motion.ts";

// The demo course: three absences so far, one of them excused as duty leave.
const absences = 3;
const dutyLeaves = 1;
const held = 35;
const attended = 31;

export const build: Build = (svg, narrow) => {
  const s = new Sketch(svg, narrow ? 420 : 1100, narrow ? 760 : 420, 31);
  const story = gsap.timeline({ paused: true });
  const left: Point = narrow ? [210, 0] : [270, 0];
  const right: Point = narrow ? [210, 420] : [830, 0];
  const holder = s.group(null);
  let credits = 3;

  const drawBudget = () => {
    holder.replaceChildren();
    const total = budget(credits);
    // Four credits is the most a course carries, so nine slots always fit one row.
    const gap = narrow ? 44 : 56;
    const size = narrow ? 36 : 40;
    const slots: Point[] = Array.from({ length: total }, (_, i) => [left[0] + (i - (total - 1) / 2) * gap, left[1] + 168]);
    const parts = {
      title: s.group(null),
      slots: s.group(null),
      bunked: s.group(null),
      leave: s.group(null),
      result: s.group(null),
    };
    for (const part of Object.values(parts)) holder.append(part);
    s.into(parts.title, () => {
      s.text(left[0], left[1] + 46, "a rough estimate", { size: 26, color: ink.line });
      s.text(left[0], left[1] + 88, `${credits} credits × 2 + 1 = ${total} bunks`, { size: 21, color: ink.soft });
    });
    s.into(parts.slots, () => {
      for (const [x, y] of slots) s.circle(x, y, size, { stroke: ink.soft, width: 1.6 });
    });
    s.into(parts.bunked, () => {
      for (const [x, y] of slots.slice(0, absences - dutyLeaves)) cross(s, x, y, size / 2);
    });
    s.into(parts.leave, () => {
      const [x, y] = slots[absences - dutyLeaves];
      s.circle(x, y, size, { stroke: ink.yellow, width: 2 });
      s.text(x, y + 6, "DL", { size: 16, color: ink.yellow });
      // Narrow screens center the note so it fits whichever slot is the duty leave.
      if (narrow) {
        s.arrow([[left[0], y + 68], [(left[0] + x) / 2 + 14, y + 50], [x + 2, y + size / 2 + 6]], { stroke: ink.yellow, width: 1.4 });
        s.text(left[0], y + 92, "duty leave doesn't count", { size: 17, color: ink.yellow });
      } else {
        s.arrow([[left[0] + 40, y + 76], [x + 24, y + 62], [x + 4, y + size / 2 + 6]], { stroke: ink.yellow, width: 1.4 });
        s.text(left[0] + 48, y + 86, "duty leave doesn't count", { size: 17, color: ink.yellow, anchor: "start" });
      }
    });
    s.into(parts.result, () => {
      const y = slots[0][1] + 150;
      s.text(left[0], y, `about ${total - (absences - dutyLeaves)} bunks left`, { size: 28, color: ink.line });
    });
    return parts;
  };

  const line = s.group(null, () => {
    const w = narrow ? 340 : 440;
    const x = right[0] - w / 2;
    const y = right[1] + 168;
    const at = (share: number) => x + w * share;
    s.text(right[0], right[1] + 46, "the 80% line", { size: 26, color: ink.line });
    s.text(right[0], right[1] + 88, `${attended} of ${held} classes attended`, { size: 21, color: ink.soft });
    s.rect(x, y - 22, w * (attended / held), 44, { stroke: "none", fill: ink.yellowFill }, 8);
    s.rect(x, y - 22, w, 44, { stroke: ink.soft, width: 1.6 }, 8);
    const need = Math.ceil(held * 0.8) / held;
    s.line([at(need), y - 40], [at(need), y + 40], { stroke: ink.line, dash: true, width: 1.6 });
    s.text(at(need), y - 60, "80%", { size: 18, color: ink.line });
    s.path(`M${at(need)} ${y + 54}Q${at(need)} ${y + 64} ${(at(need) + at(attended / held)) / 2} ${y + 64}Q${at(attended / held)} ${y + 64} ${at(attended / held)} ${y + 54}`, { stroke: ink.yellow, width: 1.6 });
    s.text((at(need) + at(attended / held)) / 2, y + 94, `+${buffer(held, attended)} spare`, { size: 20, color: ink.yellow });
    s.text(right[0], y + 160, `you need ${Math.ceil(held * 0.8)}, you have ${attended}`, { size: 20, color: ink.soft });
  });

  const play = (parts: ReturnType<typeof drawBudget>, timeline: gsap.core.Timeline, at: gsap.Position) => {
    drawOn(timeline, [parts.title, parts.slots], at, 0.8);
    drawOn(timeline, parts.bunked, ">-0.1", 0.5);
    drawOn(timeline, parts.leave, ">", 0.6);
    drawOn(timeline, parts.result, ">", 0.5);
  };

  play(drawBudget(), story, 0);
  drawOn(story, line, narrow ? ">" : 0.4, 1);
  story.to({}, { duration: 0.2 });

  return {
    story,
    act: (value) => {
      credits = Number(value);
      const quick = gsap.timeline();
      play(drawBudget(), quick, 0);
      quick.timeScale(2.2);
    },
  };
};
