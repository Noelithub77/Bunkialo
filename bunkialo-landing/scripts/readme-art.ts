// Regenerates the animated README art in assets/readme from the landing page's own scenes.
// Usage: bun scripts/readme-art.ts [page URL], with the landing page served (default: vite preview).
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Page } from "playwright";

const url = process.argv[2] ?? "http://127.0.0.1:4180/";
const root = join(import.meta.dir, "..");
const out = join(root, "..", "assets", "readme");
const fonts = { nunito: join(root, "public/fonts/nunito.woff2"), hand: join(root, "public/fonts/excalifont.woff2") };
const scenes = ["name", "bunks", "portals", "wifix", "agent"];
const yellow = "#ffab00";

/** Subsets a font to the given text and returns it as base64 woff2. */
function subset(font: string, text: string): string {
  const file = join(mkdtempSync(join(tmpdir(), "readme-art-")), "font.woff2");
  const run = Bun.spawnSync(["uvx", "--from", "fonttools[woff]", "pyftsubset", font, `--text=${text}`, "--flavor=woff2", "--layout-features=*", `--output-file=${file}`]);
  if (run.exitCode !== 0) throw new Error(`pyftsubset failed: ${run.stderr.toString()}`);
  return readFileSync(file).toString("base64");
}

const face = (family: string, data: string) => `@font-face{font-family:${family};src:url(data:font/woff2;base64,${data}) format("woff2")}`;
const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

type Exported = { body: string; viewBox: string; label: string; text: string };

/** Copies a drawn scene, drops the motion helpers, and tags every stroke and label with its step delay. */
async function exportScene(page: Page, key: string): Promise<Exported> {
  return page.evaluate((key) => {
    const figure = document.querySelector(`[data-scene="${key}"]`);
    const svg = figure instanceof SVGSVGElement ? figure : figure?.querySelector("svg");
    if (!figure || !svg) throw new Error(`Scene ${key} not found`);
    const copy = svg.cloneNode(true) as SVGSVGElement;
    for (const node of copy.querySelectorAll(".packet, .guide")) node.remove();
    for (const node of copy.querySelectorAll("[style]")) node.removeAttribute("style");
    // A bare group of bare groups (the bunk budget) holds several steps, so each child draws on its own.
    const units: Element[] = [];
    for (const child of copy.children) {
      const kids = [...child.children];
      const bare = (node: Element) => node.tagName === "g" && !node.getAttribute("class");
      if (bare(child) && kids.length > 0 && kids.every(bare)) units.push(...kids);
      else units.push(child);
    }
    const drawn = units.filter((unit) => unit.tagName === "text" || unit.querySelector("path, text, circle, rect, line, polyline"));
    const step = Math.min(0.5, 4.5 / Math.max(1, drawn.length - 1));
    drawn.forEach((unit, i) => unit.setAttribute("style", `--d:${(i * step).toFixed(2)}s`));
    for (const node of copy.querySelectorAll("path, line, polyline, rect, circle, ellipse, text")) {
      const stroke = node.getAttribute("stroke");
      const fill = node.getAttribute("fill");
      const line = node.tagName !== "text" && stroke && stroke !== "none" && (!fill || fill === "none");
      if (line) node.setAttribute("pathLength", "1");
      node.setAttribute("class", line ? "ln" : "fd");
      const d = node.getAttribute("d");
      if (d) node.setAttribute("d", d.replace(/(\d+\.\d)\d+/g, "$1"));
    }
    return { body: copy.innerHTML, viewBox: copy.getAttribute("viewBox") ?? "0 0 100 100", label: figure.getAttribute("aria-label") ?? key, text: copy.textContent ?? "" };
  }, key);
}

function sceneSvg({ body, viewBox, label, text }: Exported): string {
  const [, , w, h] = viewBox.split(" ").map(Number);
  const pad = 28;
  const style = [
    face("Hand", subset(fonts.hand, `${text} `)),
    "text{font-family:Hand,'Comic Sans MS',cursive;white-space:pre}",
    ".ln{stroke-dasharray:1;animation:ln 12s ease var(--d) infinite both}",
    ".fd{animation:fd 12s ease var(--d) infinite both}",
    "@keyframes ln{0%{stroke-dashoffset:1}7%,88%{stroke-dashoffset:0}94%,100%{stroke-dashoffset:1}}",
    "@keyframes fd{0%,2%{opacity:0}7%,88%{opacity:1}94%,100%{opacity:0}}",
    "@media(prefers-reduced-motion:reduce){.ln,.fd{animation:none}}",
  ].join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w + pad * 2}" height="${h + pad * 2}" viewBox="${-pad} ${-pad} ${w + pad * 2} ${h + pad * 2}" role="img" aria-labelledby="title"><title id="title">${escape(label)}</title><style>${style}</style><rect x="${-pad + 0.5}" y="${-pad + 0.5}" width="${w + pad * 2 - 1}" height="${h + pad * 2 - 1}" rx="24" fill="#000" stroke="#1f1f1f"/>${body}</svg>\n`;
}

/** Measures where each character sits so the hero can flip letter by letter, as the landing page does. */
async function measure(page: Page, nunito: string, rows: { text: string; size: number; spacing: number }[]): Promise<number[][]> {
  await page.setContent(`<style>${face("N", nunito)}</style><svg width="1200" height="200">${rows.map((row) => `<text font-family="N" font-weight="800" font-size="${row.size}" letter-spacing="${row.spacing}">${escape(row.text)}</text>`).join("")}</svg>`);
  await page.evaluate(() => document.fonts.ready);
  return page.evaluate(() =>
    [...document.querySelectorAll("text")].map((text) => {
      const starts = Array.from({ length: text.getNumberOfChars() }, (_, i) => text.getStartPositionOfChar(i).x);
      return [...starts, text.getComputedTextLength()];
    }),
  );
}

async function heroSvg(page: Page): Promise<string> {
  const name = "Bunkialo";
  const phrase = "bunk cheythalo?";
  const lead = "Know exactly how many classes ";
  const em = "you can skip.";
  const hand = "attendance · bunks · deadlines · mess · WiFix";
  const nunito = subset(fonts.nunito, `${name}${phrase}${lead}${em}`);
  const size = 86;
  const spacing = -2.5;
  const [nameX, phraseX] = await measure(page, nunito, [
    { text: name, size, spacing },
    { text: phrase, size, spacing },
  ]);
  const letters = (text: string, starts: number[], kind: string, color: (i: number) => string) => {
    const left = 600 - starts[starts.length - 1] / 2;
    return [...text]
      .map((char, i) => (char === " " ? "" : `<text class="${kind}" x="${(left + starts[i]).toFixed(1)}" y="282" fill="${color(i)}" style="--i:${(i * 0.025).toFixed(3)}s">${escape(char)}</text>`))
      .join("");
  };
  const logo = readFileSync(join(root, "public/logo.svg"), "utf8").replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
  const ease = "cubic-bezier(.22,1,.36,1)";
  const style = [
    face("N", nunito),
    face("Hand", subset(fonts.hand, hand)),
    `.w{font-family:N,ui-rounded,system-ui,sans-serif;font-weight:800;font-size:${size}px;letter-spacing:${spacing}px;transform-box:fill-box;transform-origin:50% 100%}`,
    `.n{animation:nm 8s ${ease} var(--i) infinite both}`,
    `.p{opacity:0;animation:ph 8s ${ease} var(--i) infinite both}`,
    "@keyframes nm{0%,27.5%{opacity:1;transform:none}31.5%{opacity:0;transform:translateY(-30%) scaleY(.5)}71%{opacity:0;transform:translateY(30%) scaleY(.5)}77.5%,100%{opacity:1;transform:none}}",
    "@keyframes ph{0%,30.6%{opacity:0;transform:translateY(30%) scaleY(.5)}36.9%,67.5%{opacity:1;transform:none}71.5%,100%{opacity:0;transform:translateY(-30%) scaleY(.5)}}",
    ".disc,.cap{transform-box:fill-box;transform-origin:50% 50%}",
    ".b{stroke:#000;stroke-width:5;stroke-dasharray:1;fill:#000;animation:draw 1.1s cubic-bezier(.65,0,.35,1) .25s both,ink .5s ease 1.05s both}",
    `.disc{animation:disc .8s ${ease} both}`,
    `.cap{animation:cap 1s ${ease} 1.1s both}`,
    "@keyframes disc{from{transform:scale(.6);opacity:0}}",
    "@keyframes draw{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}",
    "@keyframes ink{from{fill-opacity:0}}",
    "@keyframes cap{0%{transform:translate(-30%,-180%) rotate(-28deg);opacity:0}45%{transform:translate(0,12%) rotate(8deg);opacity:1}70%{transform:translate(0,-6%) rotate(-3deg)}100%{transform:none}}",
    "@media(prefers-reduced-motion:reduce){*{animation:none!important}}",
  ].join("");
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="420" viewBox="0 0 1200 420" role="img" aria-labelledby="title desc">`,
    `<title id="title">Bunkialo: bunk cheythalo?</title><desc id="desc">The yellow Bunkialo mark draws itself, then the name flips letter by letter into bunk cheythalo, Malayalam for shall we bunk. Know exactly how many classes you can skip.</desc>`,
    `<style>${style}</style>`,
    `<defs><radialGradient id="glow"><stop stop-color="${yellow}" stop-opacity=".14"/><stop offset="1" stop-color="${yellow}" stop-opacity="0"/></radialGradient></defs>`,
    `<rect x=".5" y=".5" width="1199" height="419" rx="24" fill="#000" stroke="#1f1f1f"/>`,
    `<ellipse cx="600" cy="120" rx="360" ry="190" fill="url(#glow)"/>`,
    `<svg x="528" y="34" width="144" height="144" viewBox="0 7 350 350" overflow="visible">${logo}</svg>`,
    `<g>${letters(name, nameX, "w n", () => "#f2f2f2")}${letters(phrase, phraseX, "w p", (i) => (i < 4 ? yellow : "#f2f2f2"))}</g>`,
    `<text x="600" y="336" text-anchor="middle" font-family="N,ui-rounded,system-ui,sans-serif" font-weight="700" font-size="27" fill="#f2f2f2">${lead}<tspan fill="${yellow}">${em}</tspan></text>`,
    `<text x="600" y="384" text-anchor="middle" font-family="Hand,'Comic Sans MS',cursive" font-size="22" fill="#8f8f8f">${escape(hand)}</text>`,
    `</svg>\n`,
  ].join("");
}

/** README download buttons, in the landing page's pill style. */
function buttonSvgs(): Record<string, string> {
  const labels = { play: "Get it on Google Play", web: "Open the web app", site: "Visit the website" };
  const font = face("N", subset(fonts.nunito, Object.values(labels).join("")));
  const svg = (label: string, filled: boolean, icon: string, x: number) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="260" height="48" viewBox="0 0 260 48" role="img" aria-label="${label}"><style>${font}</style>` +
    (filled ? `<rect width="260" height="48" rx="24" fill="${yellow}"/>` : `<rect x=".5" y=".5" width="259" height="47" rx="23.5" fill="#0a0a0a" stroke="#333"/>`) +
    `${icon}<text x="${x}" y="29.5" text-anchor="middle" fill="${filled ? "#1a1100" : "#f2f2f2"}" font-family="N,ui-rounded,system-ui,sans-serif" font-size="16" font-weight="700">${label}</text></svg>\n`;
  return {
    "get-it-on-google-play": svg(labels.play, true, `<path d="M38 15.5v17a1 1 0 0 0 1.5.86l14.6-8.5a1 1 0 0 0 0-1.72l-14.6-8.5A1 1 0 0 0 38 15.5z" fill="#1a1100"/>`, 148),
    "open-the-web-app": svg(labels.web, false, `<g fill="none" stroke="${yellow}" stroke-width="1.6"><circle cx="46" cy="24" r="9"/><ellipse cx="46" cy="24" rx="4" ry="9"/><path d="M37 24h18"/></g>`, 146),
    "visit-the-website": svg(labels.site, false, `<path d="M206 29l10-10m-8 0h8v8" fill="none" stroke="${yellow}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`, 124),
  };
}

mkdirSync(out, { recursive: true });
for (const [file, markup] of Object.entries(buttonSvgs())) writeFileSync(join(out, `${file}.svg`), markup);
console.log("wrote buttons");
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForFunction(() => document.querySelector('[data-scene="agent"] svg *, svg[data-scene="agent"] *') !== null);
  for (const key of scenes) {
    writeFileSync(join(out, `${key}.svg`), sceneSvg(await exportScene(page, key)));
    console.log(`wrote ${key}.svg`);
  }
  writeFileSync(join(out, "hero.svg"), await heroSvg(page));
  console.log("wrote hero.svg");
} finally {
  await browser.close();
}
