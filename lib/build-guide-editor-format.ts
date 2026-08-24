import { stringify } from "yaml";
import type { BuildGuideSource } from "@/lib/build-guides";

export function formatBuildGuideMdx(
  source: BuildGuideSource,
  content: string,
): string {
  const frontmatter = stringify(source, { lineWidth: 0 }).trimEnd();
  const body = content.trim();
  return `---\n${frontmatter}\n---\n${body ? `\n${body}\n` : ""}`;
}
