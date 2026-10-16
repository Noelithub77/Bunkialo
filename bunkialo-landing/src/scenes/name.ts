// The name: two words become a question, and the question, said fast, becomes Bunkialo.
import { gsap } from "gsap";
import { scribble } from "../icons.ts";
import { drawOn, ink, Sketch } from "../sketch.ts";
import type { Build } from "./motion.ts";

type Piece = { text: SVGTextElement; x: number; w: number };

const W = 520;

export const build: Build = (svg) => {
  const s = new Sketch(svg, W, 470, 23);
  const story = gsap.timeline({ paused: true });

  // Lays out words left to right, centered, after measuring them in Excalifont.
  const row = (parts: readonly [string, string][], y: number, size: number): Piece[] => {
    const texts = parts.map(([value, color]) => s.text(0, y, value, { size, color, anchor: "start" }));
    const widths = texts.map((text) => text.getComputedTextLength());
    let x = (W - widths.reduce((sum, w) => sum + w, 0)) / 2;
    return texts.map((text, i) => {
      for (const node of [text, ...text.querySelectorAll("tspan")]) node.setAttribute("x", x.toFixed(1));
      const piece = { text, x, w: widths[i] };
      x += widths[i];
      return piece;
    });
  };

  const words = s.group(null, () => {
    const [bunk, , cheythalo] = row([["bunk", ink.yellow], ["  +  ", ink.soft], ["cheythalo", ink.line]], 70, 44);
    s.text(bunk.x + bunk.w / 2, 108, "skip a class", { size: 17, color: ink.soft });
    s.text(cheythalo.x + cheythalo.w / 2, 108, "Malayalam: shall we?", { size: 17, color: ink.soft });
  });

  const together = s.group(null, () => {
    s.arrow([[W / 2, 124], [W / 2 - 8, 142], [W / 2, 162]], { stroke: ink.soft, width: 1.6 });
  });

  let cheyth: Piece | undefined;
  const question = s.group(null, () => {
    const pieces = row([["bunk ", ink.yellow], ["cheyth", ink.line], ["alo?", ink.line]], 252, 40);
    cheyth = pieces[1];
    s.text(W / 2, 292, "“shall we bunk?”", { size: 20, color: ink.yellow });
  });

  const fast = s.group(null, () => {
    if (!cheyth) return;
    scribble(s, [cheyth.x - 4, 239], [cheyth.x + cheyth.w + 4, 237], { stroke: ink.red });
    const caret = cheyth.x + cheyth.w / 2;
    s.polyline([[caret - 9, 214], [caret, 204], [caret + 9, 214]], { stroke: ink.yellow, width: 2.2, rough: 0.5 });
    s.text(caret, 198, "i", { size: 30, color: ink.yellow });
    s.arrow([[W / 2, 312], [W / 2 + 10, 336], [W / 2, 360]], { stroke: ink.soft, width: 1.6 });
    s.text(W / 2 + 22, 342, "say it fast", { size: 17, color: ink.soft, anchor: "start" });
  });

  const name = s.group(null, () => {
    const pieces = row([["Bunk", ink.line], ["i", ink.yellow], ["alo", ink.line]], 432, 64);
    const first = pieces[0];
    const last = pieces[2];
    scribble(s, [first.x, 452], [last.x + last.w, 450], { stroke: ink.yellow });
  });

  story.addLabel("step0", 0);
  drawOn(story, words, "step0", 0.8);
  story.addLabel("step1", ">");
  drawOn(story, [together, question], "step1", 0.8);
  story.addLabel("step2", ">+0.1");
  drawOn(story, fast, "step2", 0.8);
  story.addLabel("step3", ">+0.1");
  drawOn(story, name, "step3", 0.9);
  story.to({}, { duration: 0.3 });
  return { story };
};
