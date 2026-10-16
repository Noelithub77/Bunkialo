// WiFix: the internet is blocked by a login page, WiFix signs in, then checks the internet really answers.
import { gsap } from "gsap";
import { check, cloud, cross, loginPage, phone, wifi } from "../icons.ts";
import { drawOn, ink, type Point, Sketch } from "../sketch.ts";
import { type Build, stream, travel } from "./motion.ts";

export const build: Build = (svg, narrow) => {
  const s = new Sketch(svg, narrow ? 420 : 1150, narrow ? 800 : 470, 79);
  const story = gsap.timeline({ paused: true });
  const loop = gsap.timeline({ paused: true });
  const at = (wide: Point, tall: Point): Point => (narrow ? tall : wide);
  const device = at([120, 250], [100, 90]);
  const sky = at([1010, 250], [130, 700]);
  const portal = at([620, 360], [290, 400]);
  const blocked = at([470, 205], [100, 300]);

  const scene = s.group(null, () => {
    phone(s, device[0], device[1], 110, { stroke: ink.line });
    s.text(device[0], device[1] + 86, "your phone", { size: 18, color: ink.soft });
    const signal = at([device[0], device[1] - 120], [300, 84]);
    wifi(s, signal[0], signal[1], 54, ink.soft);
    s.text(signal[0], signal[1] + 34, "campus Wi‑Fi", { size: 17, color: ink.soft });
    cloud(s, sky[0], sky[1], narrow ? 170 : 210, { stroke: ink.soft });
    s.text(sky[0], sky[1] + 8, "internet", { size: 21, color: ink.line });
  });

  const probe = s.arrow(narrow ? [[device[0], device[1] + 104], [blocked[0], blocked[1] - 26]] : [[device[0] + 44, device[1] - 30], [blocked[0] - 30, blocked[1]]], { stroke: ink.soft, width: 1.6 });
  const wall = s.group(null, () => {
    cross(s, blocked[0], blocked[1], 30);
    s.text(blocked[0] + (narrow ? 34 : 0), blocked[1] + (narrow ? 8 : -36), "blocked", { size: 18, color: ink.red, anchor: narrow ? "start" : "middle" });
  });
  const page = loginPage(s, portal[0], portal[1], narrow ? 170 : 200, ink.line);
  const redirect = s.arrow(narrow ? [[blocked[0] + 18, blocked[1] + 22], [blocked[0] + 60, blocked[1] + 70], [portal[0] - 92, portal[1]]] : [[blocked[0] + 6, blocked[1] + 24], [blocked[0] + 12, portal[1] - 56], [portal[0] - 108, portal[1] - 46]], { stroke: ink.red, width: 1.6, dash: true });

  const spot = s.group(null, () => {
    const [x, y] = narrow ? [portal[0], portal[1] + 124] : [portal[0] + 140, portal[1] - 130];
    s.text(x, y, "WiFix spots the\ncampus login page", { size: 18, color: ink.yellow });
    s.arrow(narrow ? [[x, y - 20], [x + 6, y - 32], [x, y - 44]] : [[x - 40, y + 32], [x - 70, y + 70], [portal[0] + 60, portal[1] - 70]], { stroke: ink.yellow, width: 1.4 });
  });

  const login = s.arrow(narrow ? [[device[0] + 36, device[1] + 10], [portal[0], device[1] + 80], [portal[0], portal[1] - 74]] : [[device[0] + 44, device[1] + 30], [device[0] + 230, portal[1] + 60], [portal[0] - 110, portal[1] + 30]], { stroke: ink.yellow, width: 1.8 });
  const loginLabel = s.text(...(narrow ? ([200, device[1] + 150] as const) : ([device[0] + 200, portal[1] + 92] as const)), "your LMS login", { size: 18, color: ink.yellow });
  const typed = s.group(null, () => {
    const x = portal[0] - (narrow ? 70 : 82);
    const top = portal[1] - (narrow ? 66 : 78) + 70;
    s.text(x, top + 17, "2024bcs····", { size: 15, color: ink.yellow, anchor: "start" });
    s.text(x, top + 51, "••••••••", { size: 15, color: ink.yellow, anchor: "start" });
  });

  const online = s.arrow(narrow ? [[device[0] - 36, device[1] + 16], [20, 400], [sky[0] - 70, sky[1] - 30]] : [[device[0] + 50, device[1] - 60], [560, 70], [sky[0] - 90, sky[1] - 50]], { stroke: ink.green, width: 2 });
  const done = s.group(null, () => {
    const [x, y] = narrow ? [315, 640] : [500, 40];
    check(s, x, y, 24);
    s.text(narrow ? x : x + 28, narrow ? y + 44 : y + 8, "online, confirmed", { size: 19, color: ink.green, anchor: narrow ? "middle" : "start" });
  });

  story.addLabel("step0", 0);
  drawOn(story, scene, "step0", 0.9);
  drawOn(story, probe.group, ">-0.2", 0.5);
  drawOn(story, wall, ">", 0.4);
  story.addLabel("step1", ">+0.2");
  drawOn(story, [redirect.group, page.group], "step1", 0.7);
  drawOn(story, spot, ">", 0.6);
  story.addLabel("step2", ">+0.2");
  drawOn(story, [login.group, loginLabel], "step2", 0.6);
  travel(story, s, login.guide, ink.yellow, ">", 0.8);
  drawOn(story, typed, ">-0.1", 0.4);
  story.addLabel("step3", ">+0.2");
  drawOn(story, online.group, "step3", 0.7);
  drawOn(story, done, ">-0.1", 0.5);
  story.to({}, { duration: 0.2 });

  stream(loop, s, online.guide, ink.green, 3, 2.4, 5);
  return { story, loop };
};
