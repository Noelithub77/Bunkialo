// The recurring characters of every diagram, drawn around a center point.
import { ink, type Point, type Sketch, type Style } from "./sketch.ts";

export function phone(s: Sketch, cx: number, cy: number, h: number, style: Style = {}): SVGGElement {
  const w = h * 0.52;
  return s.group("phone", () => {
    s.rect(cx - w / 2, cy - h / 2, w, h, { fill: ink.greyFill, ...style }, Math.max(6, w * 0.18));
    s.line([cx - w * 0.15, cy - h / 2 + h * 0.08], [cx + w * 0.15, cy - h / 2 + h * 0.08], { ...style, width: 2, rough: 0.5 });
  });
}

/** A face with shoulders. */
export function person(s: Sketch, cx: number, cy: number, r: number, color: string = ink.line): SVGGElement {
  return s.group("person", () => {
    s.circle(cx, cy, r * 2, { fill: ink.bg, stroke: color });
    s.path(`M${cx - r * 1.5} ${cy + r * 2.7}Q${cx - r * 1.4} ${cy + r * 1.25} ${cx} ${cy + r * 1.25}Q${cx + r * 1.4} ${cy + r * 1.25} ${cx + r * 1.5} ${cy + r * 2.7}`, { stroke: color });
    const eye = r * 0.32;
    s.shape("circle", { cx: cx - eye, cy: cy - r * 0.15, r: Math.max(1.6, r * 0.09), fill: color });
    s.shape("circle", { cx: cx + eye, cy: cy - r * 0.15, r: Math.max(1.6, r * 0.09), fill: color });
    s.path(`M${cx - r * 0.42} ${cy + r * 0.33}Q${cx} ${cy + r * 0.78} ${cx + r * 0.42} ${cy + r * 0.33}`, { stroke: color, width: 2, rough: 0.5 });
  });
}

/** Arcs opening upward with a dot: the Wi-Fi symbol. */
export function wifi(s: Sketch, cx: number, cy: number, size: number, color: string): SVGGElement {
  return s.group("wifi", () => {
    for (let i = 1; i <= 3; i += 1) {
      const r = (size / 3) * i;
      const a = -Math.PI / 2 - 0.8;
      const b = -Math.PI / 2 + 0.8;
      s.path(`M${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)}A${r} ${r} 0 0 1 ${cx + r * Math.cos(b)} ${cy + r * Math.sin(b)}`, { stroke: color, width: 2.4 });
    }
    s.shape("circle", { cx, cy, r: size * 0.07, fill: color });
  });
}

export function cloud(s: Sketch, cx: number, cy: number, w: number, style: Style = {}): SVGGElement {
  const h = w * 0.5;
  const d = `M${cx - w * 0.36} ${cy + h * 0.42}C${cx - w * 0.56} ${cy + h * 0.42} ${cx - w * 0.56} ${cy - h * 0.1} ${cx - w * 0.33} ${cy - h * 0.06}C${cx - w * 0.3} ${cy - h * 0.6} ${cx + w * 0.1} ${cy - h * 0.66} ${cx + w * 0.14} ${cy - h * 0.2}C${cx + w * 0.4} ${cy - h * 0.38} ${cx + w * 0.58} ${cy - h * 0.02} ${cx + w * 0.4} ${cy + h * 0.42}Z`;
  return s.path(d, { fill: ink.greyFill, ...style });
}

/** A labeled box; multi-line labels stay centered. */
export function box(s: Sketch, cx: number, cy: number, w: number, h: number, label: string, style: Style = {}, size = 20): SVGGElement {
  return s.group("box", () => {
    s.rect(cx - w / 2, cy - h / 2, w, h, style);
    const lines = label.split("\n").length;
    s.text(cx, cy + size * 0.35 - ((lines - 1) * size * 1.2) / 2, label, { size, color: style.stroke ?? ink.line });
  });
}

/** A small browser window with a title and two input fields: the campus login page. */
export function loginPage(s: Sketch, cx: number, cy: number, w: number, color: string = ink.line): { group: SVGGElement; fields: SVGGElement[] } {
  const h = w * 0.78;
  const x = cx - w / 2;
  const y = cy - h / 2;
  const fields: SVGGElement[] = [];
  const group = s.group("login", () => {
    s.rect(x, y, w, h, { stroke: color, fill: ink.bg }, 10);
    s.line([x, y + 26], [x + w, y + 26], { stroke: color, width: 1.4, rough: 0.6 });
    for (let i = 0; i < 3; i += 1) s.shape("circle", { cx: x + 14 + i * 12, cy: y + 13, r: 3, fill: ink.soft });
    s.text(cx, y + 56, "campus login", { size: 17, color: ink.soft });
    for (const row of [0, 1]) {
      const field = s.group("field", () => s.rect(x + 18, y + 70 + row * 34, w - 36, 24, { stroke: ink.soft, width: 1.4 }, 6));
      fields.push(field);
    }
  });
  return { group, fields };
}

export function check(s: Sketch, cx: number, cy: number, size: number, color: string = ink.green): SVGGElement {
  return s.polyline([[cx - size * 0.5, cy], [cx - size * 0.12, cy + size * 0.38], [cx + size * 0.55, cy - size * 0.42]], { stroke: color, width: 3, rough: 0.6 });
}

export function cross(s: Sketch, cx: number, cy: number, size: number, color: string = ink.red): SVGGElement {
  const h = size / 2;
  return s.group("cross", () => {
    s.line([cx - h, cy - h], [cx + h, cy + h], { stroke: color, width: 3, rough: 0.7 });
    s.line([cx + h, cy - h], [cx - h, cy + h], { stroke: color, width: 3, rough: 0.7 });
  });
}

/** A hand-drawn underline or strike, slightly wavy. */
export function scribble(s: Sketch, from: Point, to: Point, style: Style = {}): SVGGElement {
  const mid: Point = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2 + 4];
  return s.path(`M${from[0]} ${from[1]}Q${mid[0]} ${mid[1]} ${to[0]} ${to[1]}`, { width: 3, rough: 1.2, ...style });
}

/** A small filled dot that travels along guides: crisp, so it reads as data, not ink. */
export function packet(s: Sketch, color: string, r = 6): SVGCircleElement {
  return s.shape("circle", { cx: 0, cy: 0, r, fill: color, opacity: 0, class: "packet" });
}
