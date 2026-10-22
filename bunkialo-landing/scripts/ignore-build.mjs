import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const relevant = (name) => name === ".vercelignore" || name.startsWith("bunkialo-landing/") || name.startsWith("assets/landing/");

// Vercel filters the checkout before this step, so Git metadata may be absent.
export async function shouldSkipBuild({ base, head, repository, git = spawnSync, request = fetch }) {
  const diff = git("git", ["diff", "--name-only", base || "HEAD^", head || "HEAD", "--"], { encoding: "utf8" });
  if (diff.status === 0) {
    return !diff.stdout.trim().split("\n").filter(Boolean).some(relevant);
  }
  if (!/^[a-f\d]{7,40}$/i.test(base ?? "") || !/^[a-f\d]{7,40}$/i.test(head ?? "")) return false;
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) return false;
  try {
    const response = await request(`https://api.github.com/repos/${repository}/compare/${base}...${head}`, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "bunkialo-landing-build" },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return false;
    const comparison = await response.json();
    if (!comparison || !Array.isArray(comparison.files) || comparison.files.length >= 300) return false;
    return comparison.files.every((file) =>
      typeof file.filename === "string" && !relevant(file.filename) &&
      (file.previous_filename === undefined || (typeof file.previous_filename === "string" && !relevant(file.previous_filename))),
    );
  } catch {
    return false;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const skip = await shouldSkipBuild({
    base: process.env.VERCEL_GIT_PREVIOUS_SHA,
    head: process.env.VERCEL_GIT_COMMIT_SHA,
    repository: `${process.env.VERCEL_GIT_REPO_OWNER || "Noelithub77"}/${process.env.VERCEL_GIT_REPO_SLUG || "Bunkialo"}`,
  });
  console.log(skip ? "Landing files unchanged; skipping build." : "Landing changed or comparison unavailable; building.");
  // The ignored-build contract uses 0 to skip and 1 to continue.
  process.exitCode = skip ? 0 : 1;
}
