import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { extname } from "node:path";

const forbidden = String.fromCodePoint(0x2014);
const extensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".html", ".css", ".md"]);
const files = execFileSync("git", ["ls-files", "-co", "--exclude-standard"], { encoding: "utf8" })
  .trim().split("\n").filter((file) => extensions.has(extname(file)) && !file.includes("node_modules/"));
const matches = files.flatMap((file) => {
  const lines = readFileSync(file, "utf8").split("\n");
  return lines.flatMap((line, index) => line.includes(forbidden) ? [`${file}:${index + 1}`] : []);
});
if (matches.length) {
  console.error(`no-em-dash-copy: replace the em dash character in:\n${matches.join("\n")}`);
  process.exitCode = 1;
}
