import { readFileSync } from "node:fs";
import { defineConfig, type Plugin } from "vite";

// The hero and closing marks are inline so CSS can animate their parts; ../assets/landing/logo.svg stays the single source.
const inlineLogo = (): Plugin => ({
  name: "inline-logo",
  transformIndexHtml(html) {
    const svg = readFileSync(new URL("../assets/landing/logo.svg", import.meta.url), "utf8").trim();
    return html.replaceAll(/<!--logo:([\w-]+)-->/g, (_, className: string) =>
      svg.replace("<svg ", `<svg class="logo ${className}" role="img" aria-label="Bunkialo logo" `),
    );
  },
});

export default defineConfig({
  publicDir: "../assets/landing",
  plugins: [inlineLogo()],
  server: { port: 4173, strictPort: true },
  build: {
    target: "es2022",
    modulePreload: { polyfill: false },
  },
});
