# Bunkialo landing page

A static site built with Vite and TypeScript and deployed to Vercel at <https://bunkialo.noel.is-a.dev>.

```bash
bun install
bun run dev      # http://127.0.0.1:4173
bun test         # platform links and bunk math
bun run build    # type check, then build to dist/
```

## How it loads

- `index.html` holds all the content and inlines the critical CSS, so the hero renders before any script runs. The build replaces `<!--logo:CLASS-->` with `../assets/landing/logo.svg` (see `vite.config.ts`).
- `src/main.ts` stays small. It picks the download button for the device (Google Play on Android, the web app everywhere else), loads videos only when they come near the screen, and wires up the copy buttons.
- `src/enhance.ts` loads when the browser is idle. It adds Lenis smooth scrolling, GSAP text motion, the agent prompt and the hand-drawn scenes.
- `src/scenes/*.ts` draw Excalidraw-style sketches with rough.js. Each scene returns a paused GSAP timeline, labelled `step0…` to match its step pills. Every scene has a wide layout and a narrow one (960 px and below).
- With reduced motion turned on, scenes show their final frame, videos wait for a tap, and nothing animates.
- Scenes start at the viewport edge and keep their drawing animation. Fast scrolling above 2500 pixels per second speeds the sequence up to finish in about 0.6 seconds; desktop WiFix scrubbing also accelerates without jumping to the end.

## Media

App recordings use dark mode and anonymised demo data. Each feature has four files in `../assets/landing/media/`:

- a 540 px wide AV1 `webm` (SVT-AV1, CRF 50) and an H.264 `mp4` fallback;
- `avif` and `webp` posters at 544×1176.

Stills for Wear OS and Omarchy are `avif` with a `webp` fallback. Font details are in `../assets/landing/fonts/README.md`.

## README art

`scripts/readme-art.ts` exports the hero, download buttons and the five scenes to `assets/readme/` for the repository README. Each SVG embeds a Nunito or Excalifont subset and loops its draw-on animation, which stops under reduced motion. Subsetting runs `pyftsubset` through `uvx`, and Playwright comes from the root `node_modules`.

```bash
bun run build && bunx vite preview --port 4180 &
bun scripts/readme-art.ts    # or pass another page URL
```

## Deployment

Run `vercel deploy --prod` from the repository root using the existing `bunkialo2` project link. Its root directory is `bunkialo-landing`; `vercel.json` selects Vite and `dist/` instead of the previous Next.js settings. The root `.vercelignore` includes the landing source and `assets/landing/`, leaving native builds, local state and credentials out of the upload.
