import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import grapplingHookData from "@/data/season-talents/s3/grappling-hook.json";
import ironFistData from "@/data/season-talents/s3/iron-fist.json";
import passiveData from "@/data/season-talents/s3/passives.json";
import zeroData from "@/data/season-talents/s3/zero.json";
import { formatBuildGuideMdx } from "@/lib/build-guide-editor-format";
import {
  buildGuideSourceSchema,
  resolveBuildGuideSource,
  type BuildGuideSource,
  type S3BuildTalentId,
} from "@/lib/build-guides";
import { getAllPerks } from "@/lib/perks";
import { getResolvedFieldValue } from "@/lib/weapon-consumers";
import { getAllResolvedWeapons } from "@/lib/weapons";
import type { PerkSlot } from "@/types";

const BUILD_GUIDE_DIRECTORY = path.join(process.cwd(), "data", "builds");
const DEFAULT_BUILD_GUIDE_FILE = "builds/s3-build-template.mdx";
const BUILD_GUIDE_FILE_PATTERN = /^builds\/([\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*)\.mdx$/u;

interface S3TalentNodeSource {
  id: string;
  name: string;
  icon: string;
  phase: number;
  column: number;
  descriptions: string[];
}

interface S3TalentTreeSource {
  id: S3BuildTalentId;
  name: string;
  nodes: S3TalentNodeSource[];
}

export interface BuildGuideEditorWeaponOption {
  slug: string;
  title: string;
  useType: "主武器" | "副武器" | "近战武器";
  weaponTypeId?: number;
  icon: string;
}

export interface BuildGuideEditorPerkOption {
  slug: string;
  name: string;
  slot: PerkSlot;
  icon?: string;
  weaponType: number[];
  weaponNames: string[];
}

export interface BuildGuideEditorTalentTreeOption {
  id: S3BuildTalentId;
  name: string;
  icon: string;
  description: string;
}

export interface BuildGuideEditorPassiveOption {
  id: string;
  name: string;
  icon: string;
  description: string;
}

export interface BuildGuideEditorRouteStage {
  phase: number;
  options: Array<{
    value: "1" | "2" | "3" | "4";
    name: string;
    icon: string;
    description: string;
  }>;
}

export interface BuildGuideEditorCatalog {
  files: string[];
  weapons: BuildGuideEditorWeaponOption[];
  perks: BuildGuideEditorPerkOption[];
  talentTrees: BuildGuideEditorTalentTreeOption[];
  passives: BuildGuideEditorPassiveOption[];
  routeStages: BuildGuideEditorRouteStage[];
}

export interface BuildGuideEditorDocument {
  file: string;
  slug: string;
  source: BuildGuideSource;
  content: string;
}

function parseTalentTree(
  data: unknown,
  expectedId: S3BuildTalentId,
): S3TalentTreeSource {
  const tree = data as S3TalentTreeSource;
  if (tree.id !== expectedId || !Array.isArray(tree.nodes)) {
    throw new Error(`S3 天赋树数据无效: ${expectedId}`);
  }
  return tree;
}

const TALENT_TREES: S3TalentTreeSource[] = [
  parseTalentTree(zeroData, "zero"),
  parseTalentTree(grapplingHookData, "grappling-hook"),
  parseTalentTree(ironFistData, "iron-fist"),
];

export function resolveBuildGuideEditorFile(file: string): {
  file: string;
  slug: string;
  absolutePath: string;
} {
  const normalized = file.replaceAll("\\", "/");
  const match = BUILD_GUIDE_FILE_PATTERN.exec(normalized);
  if (!match) {
    throw new Error("文件必须是 data/builds 下的安全 MDX 文件名");
  }
  const slug = match[1];
  return {
    file: `builds/${slug}.mdx`,
    slug,
    absolutePath: path.join(BUILD_GUIDE_DIRECTORY, `${slug}.mdx`),
  };
}

function listBuildGuideFiles(): string[] {
  if (!fs.existsSync(BUILD_GUIDE_DIRECTORY)) return [];
  return fs
    .readdirSync(BUILD_GUIDE_DIRECTORY)
    .filter((file) => file.endsWith(".mdx"))
    .map((file) => `builds/${file}`)
    .sort((left, right) => left.localeCompare(right, "zh-CN"));
}

function readBuildGuideDocument(file: string): BuildGuideEditorDocument {
  const resolved = resolveBuildGuideEditorFile(file);
  if (!fs.existsSync(resolved.absolutePath)) {
    throw new Error(`攻略文件不存在: ${resolved.file}`);
  }
  const parsed = matter(fs.readFileSync(resolved.absolutePath, "utf8"));
  const result = buildGuideSourceSchema.safeParse(parsed.data);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`攻略 frontmatter 无效: ${details}`);
  }
  return {
    file: resolved.file,
    slug: resolved.slug,
    source: result.data,
    content: parsed.content.trim(),
  };
}

export async function getBuildGuideEditorData(
  requestedFile?: string,
): Promise<{
  catalog: BuildGuideEditorCatalog;
  document: BuildGuideEditorDocument;
}> {
  const files = listBuildGuideFiles();
  const selectedFile = requestedFile
    ? resolveBuildGuideEditorFile(requestedFile).file
    : files.includes(DEFAULT_BUILD_GUIDE_FILE)
      ? DEFAULT_BUILD_GUIDE_FILE
      : files[0];
  if (!selectedFile) throw new Error("data/builds 中没有可编辑的攻略文件");

  const [weapons] = await Promise.all([getAllResolvedWeapons("lc")]);
  const weaponOptions = weapons
    .filter(
      (weapon): weapon is typeof weapon & {
        useType: "主武器" | "副武器" | "近战武器";
      } =>
        weapon.useType === "主武器" ||
        weapon.useType === "副武器" ||
        weapon.useType === "近战武器",
    )
    .map((weapon) => ({
      slug: weapon.slug,
      title: weapon.title,
      useType: weapon.useType,
      weaponTypeId: getResolvedFieldValue(weapon.weaponTypeId),
      icon: `/icons/weapons/normal/${weapon.title}.png`,
    }));

  const perks = getAllPerks().map((perk) => ({
    slug: perk.slug,
    name: perk.name,
    slot: perk.slot,
    icon: perk.icon ? `/webp/icons/perks/${perk.icon}.webp` : undefined,
    weaponType: perk.weaponType ?? [],
    weaponNames: perk.weaponNames ?? [],
  }));

  const sharedGeneralNodes = TALENT_TREES[0].nodes.filter(
    (node) => node.column >= 5,
  );
  const routeStages = [2, 3, 4, 5, 6].map((phase) => ({
    phase,
    options: sharedGeneralNodes
      .filter((node) => node.phase === phase)
      .sort((left, right) => left.column - right.column)
      .map((node) => ({
        value: String(node.column - 4) as "1" | "2" | "3" | "4",
        name: node.name,
        icon: node.icon,
        description: node.descriptions.at(-1) ?? "",
      })),
  }));

  return {
    catalog: {
      files,
      weapons: weaponOptions,
      perks,
      talentTrees: TALENT_TREES.map((tree) => ({
        id: tree.id,
        name: tree.name,
        icon: tree.nodes[0].icon,
        description: tree.nodes[0].descriptions.at(-1) ?? "",
      })),
      passives: (
        passiveData as {
          passives: BuildGuideEditorPassiveOption[];
        }
      ).passives.map(({ id, name, icon, description }) => ({
        id,
        name,
        icon,
        description,
      })),
      routeStages,
    },
    document: readBuildGuideDocument(selectedFile),
  };
}

export async function saveBuildGuideEditorDocument(input: {
  slug: string;
  originalFile?: unknown;
  source: unknown;
  content: unknown;
}): Promise<{ file: string; slug: string }> {
  if (process.env.NODE_ENV !== "development") {
    throw new Error("攻略编辑器仅允许在开发环境写入文件");
  }
  if (typeof input.content !== "string") {
    throw new Error("攻略正文必须是文本");
  }
  const resolved = resolveBuildGuideEditorFile(`builds/${input.slug}.mdx`);
  const original =
    typeof input.originalFile === "string" && input.originalFile
      ? resolveBuildGuideEditorFile(input.originalFile)
      : undefined;
  if (fs.existsSync(resolved.absolutePath) && original?.file !== resolved.file) {
    throw new Error(`攻略文件已存在: ${resolved.file}`);
  }
  if (
    original &&
    original.file !== resolved.file &&
    !fs.existsSync(original.absolutePath)
  ) {
    throw new Error(`原攻略文件不存在: ${original.file}`);
  }
  const source = buildGuideSourceSchema.parse(input.source);
  await resolveBuildGuideSource(source, resolved.slug, input.content);

  fs.mkdirSync(BUILD_GUIDE_DIRECTORY, { recursive: true });
  const output = formatBuildGuideMdx(source, input.content);
  fs.writeFileSync(resolved.absolutePath, output, "utf8");
  if (original && original.file !== resolved.file) {
    try {
      fs.unlinkSync(original.absolutePath);
    } catch (error) {
      fs.rmSync(resolved.absolutePath, { force: true });
      throw error;
    }
  }
  return { file: resolved.file, slug: resolved.slug };
}
