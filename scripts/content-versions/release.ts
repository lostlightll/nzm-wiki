import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { z } from "zod";

export const RELEASE_FILE = "config/content-version.json";
const identifier = z.string().regex(/^[a-z0-9][a-z0-9.-]*$/).max(64)
  .refine(value => !value.endsWith(".") && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(value));
export const releaseSchema = z.strictObject({
  schemaVersion: z.literal(1),
  season: identifier,
  version: identifier,
  phase: z.enum(["current", "candidate"]),
  basedOn: identifier.optional(),
  preview: z.strictObject({
    season: identifier,
    version: identifier,
    label: z.string().trim().min(1),
  }).optional(),
});
export type ContentRelease = z.infer<typeof releaseSchema>;

export function readRelease(root: string): ContentRelease {
  return releaseSchema.parse(JSON.parse(fs.readFileSync(path.join(root, RELEASE_FILE), "utf8")));
}

export function writeRelease(root: string, release: ContentRelease): void {
  const valid = releaseSchema.parse(release);
  fs.writeFileSync(path.join(root, RELEASE_FILE), JSON.stringify(valid, null, 2) + "\n");
}

export function git(root: string, args: string[]): string {
  return execFileSync("git", args, { cwd: root, encoding: "utf8", windowsHide: true }).trim();
}

/** A candidate gets ordinary project files in a Git worktree, never runtime season branches. */
export function prepareRelease(root: string, season: string, version: string): string {
  const current = readRelease(root);
  const next = releaseSchema.parse({ schemaVersion: 1, season, version, phase: "candidate", basedOn: current.version, preview: current.preview });
  if (current.phase !== "current") throw new Error("Prepare from the current release, not another candidate");
  if (current.version === version) throw new Error("Choose a new version identifier");
  if (git(root, ["status", "--porcelain"])) throw new Error("Commit current work before preparing a candidate worktree");
  const target = path.join(root, "MD/_local/content-versions/worktrees", version);
  if (fs.existsSync(target)) throw new Error(`Candidate already exists: ${target}`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  git(root, ["worktree", "add", "-b", `codex/content-${version}`, target, "HEAD"]);
  // Keep any created worktree on failure; never erase edits or invoke destructive Git cleanup.
  writeRelease(target, next);
  return target;
}

export function assertReleaseReady(
  release: ContentRelease,
  overlimit: { season: { id: string; status: string }; withdrawn?: boolean },
  perks: readonly { season?: string }[],
): void {
  if (overlimit.withdrawn) throw new Error("Publish a reviewed overlimit catalog before finalizing");
  if (overlimit.season.id !== release.version || overlimit.season.status !== "current") {
    throw new Error(`Overlimit must be reviewed and current for version ${release.version}`);
  }
  // A future preview may remain during ordinary maintenance; the season being released may not.
  if (perks.some(perk => perk.season === `${release.season}-preview`)) {
    throw new Error(`Review and promote ${release.season}-preview perks before finalizing`);
  }
  if (release.preview?.season === release.season) {
    throw new Error("Remove the released season's preview entry after migrating its content and evidence");
  }
}
