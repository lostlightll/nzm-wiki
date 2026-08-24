import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { z } from "zod";
import grapplingHookData from "@/data/season-talents/s3/grappling-hook.json";
import ironFistData from "@/data/season-talents/s3/iron-fist.json";
import passiveData from "@/data/season-talents/s3/passives.json";
import zeroData from "@/data/season-talents/s3/zero.json";
import { getResolvedFieldValue } from "@/lib/weapon-consumers";
import { getAllResolvedWeapons } from "@/lib/weapons";
import { getAllPerks } from "@/lib/perks";
import type { ResolvedWeapon } from "@/lib/weapon-resolver";
import type { Perk, PerkSlot } from "@/types";

const BUILD_GUIDE_DIRECTORY = path.join(process.cwd(), "data", "builds");
const S3_ROUTE_PATTERN = /^[1-4]{5}$/;

export const BUILD_GUIDE_PERK_SLOTS = [1, 2, 3, 4] as const;
export type BuildGuidePerkSlot = (typeof BUILD_GUIDE_PERK_SLOTS)[number];
export type S3BuildTalentId = "zero" | "grappling-hook" | "iron-fist";

const perkSetSchema = z
  .object({
    "1": z.string().trim(),
    "2": z.string().trim(),
    "3": z.string().trim(),
    "4": z.string().trim(),
  })
  .strict();

export const buildGuideSourceSchema = z
  .object({
    title: z.string().trim().min(1),
    summary: z.string().trim().min(1),
    source: z.string().trim().min(1),
    season: z.literal("s3"),
    draft: z.boolean().optional().default(false),
    tags: z.array(z.string().trim().min(1)).optional().default([]),
    weapons: z
      .object({
        primary: z.string().trim().min(1),
        secondary: z.string().trim().min(1),
        melee: z.string().trim().min(1),
      })
      .strict(),
    perks: z
      .object({
        primary: perkSetSchema,
        secondary: perkSetSchema,
      })
      .strict(),
    talent: z
      .object({
        tree: z.enum(["zero", "grappling-hook", "iron-fist"]),
        passive: z.string().trim().min(1),
        route: z.string().regex(S3_ROUTE_PATTERN, "必须是五位 1-4 数字"),
      })
      .strict(),
  })
  .strict();

export type BuildGuideSource = z.infer<typeof buildGuideSourceSchema>;

interface S3TalentNodeSource {
  id: string;
  name: string;
  icon: string;
  phase: number;
  column: number;
  maxLevel: number;
  descriptions: string[];
}

interface S3TalentTreeSource {
  id: string;
  talentType: number;
  name: string;
  nodes: S3TalentNodeSource[];
}

interface S3PassiveSource {
  id: string;
  name: string;
  icon: string;
  description: string;
}

const S3_TREES: Record<S3BuildTalentId, S3TalentTreeSource> = {
  zero: zeroData as S3TalentTreeSource,
  "grappling-hook": grapplingHookData as S3TalentTreeSource,
  "iron-fist": ironFistData as S3TalentTreeSource,
};

const S3_PASSIVES = (passiveData as { passives: S3PassiveSource[] }).passives;
const SHARED_GENERAL_NODES = (zeroData as S3TalentTreeSource).nodes.filter(
  (node) => node.column >= 5,
);

export interface ResolvedBuildGuideWeapon {
  slug: string;
  title: string;
  useType: string;
  weaponTypeId?: number;
  icon: string;
  href: string;
}

export interface ResolvedBuildGuidePerk {
  slug: string;
  name: string;
  slot: PerkSlot;
  icon?: string;
  href: string;
}

export type ResolvedBuildGuidePerkSet = Record<
  BuildGuidePerkSlot,
  ResolvedBuildGuidePerk | null
>;

export interface ResolvedBuildGuideTalentNode {
  id: string;
  canonicalId: string;
  name: string;
  icon: string;
  phase: number;
  level: number;
  description: string;
  href: string;
}

export interface ResolvedBuildGuideTalent {
  tree: S3BuildTalentId;
  treeName: string;
  treeIcon: string;
  treeDescription: string;
  treeHref: string;
  passive: {
    id: string;
    name: string;
    icon: string;
    description: string;
    href: string;
  };
  route: string;
  nodes: ResolvedBuildGuideTalentNode[];
  exclusivePoints: number;
  generalPoints: number;
  totalPoints: number;
}

export interface ResolvedBuildGuide {
  slug: string;
  title: string;
  summary: string;
  source: string;
  season: "s3";
  draft: boolean;
  tags: string[];
  content: string;
  weapons: {
    primary: ResolvedBuildGuideWeapon;
    secondary: ResolvedBuildGuideWeapon;
    melee: ResolvedBuildGuideWeapon;
  };
  perks: {
    primary: ResolvedBuildGuidePerkSet;
    secondary: ResolvedBuildGuidePerkSet;
  };
  talent: ResolvedBuildGuideTalent;
}

export type BuildGuideSummary = Omit<ResolvedBuildGuide, "content">;

interface BuildGuideResolutionContext {
  weapons: Map<string, ResolvedWeapon>;
  perks: Map<string, Perk>;
}

function buildGuideError(slug: string, message: string): Error {
  return new Error(`搭配攻略 ${slug}: ${message}`);
}

function parseBuildGuideSource(metadata: unknown, slug: string): BuildGuideSource {
  const result = buildGuideSourceSchema.safeParse(metadata);
  if (result.success) return result.data;
  const details = result.error.issues
    .map((issue) => `${issue.path.join(".") || "frontmatter"}: ${issue.message}`)
    .join("; ");
  throw buildGuideError(slug, details);
}

function resolveWeapon(
  context: BuildGuideResolutionContext,
  slug: string,
  expectedUseType: "主武器" | "副武器" | "近战武器",
  guideSlug: string,
): ResolvedBuildGuideWeapon {
  const weapon = context.weapons.get(slug);
  if (!weapon) throw buildGuideError(guideSlug, `武器不存在: ${slug}`);
  if (weapon.useType !== expectedUseType) {
    throw buildGuideError(
      guideSlug,
      `${slug} 的用途应为${expectedUseType}，实际为${weapon.useType ?? "未知"}`,
    );
  }

  return {
    slug: weapon.slug,
    title: weapon.title,
    useType: weapon.useType,
    weaponTypeId: getResolvedFieldValue(weapon.weaponTypeId),
    icon: `/icons/weapons/normal/${weapon.title}.png`,
    href: `/weapons/${encodeURIComponent(weapon.slug)}`,
  };
}

function assertPerkAppliesToWeapon(
  perk: Perk,
  weapon: ResolvedBuildGuideWeapon,
  guideSlug: string,
) {
  if (perk.weaponNames?.length) {
    if (!perk.weaponNames.includes(weapon.title)) {
      throw buildGuideError(
        guideSlug,
        `插件 ${perk.slug} 不适用于武器 ${weapon.title}`,
      );
    }
    return;
  }

  if (
    perk.weaponType?.length &&
    (weapon.weaponTypeId === undefined || !perk.weaponType.includes(weapon.weaponTypeId))
  ) {
    throw buildGuideError(
      guideSlug,
      `插件 ${perk.slug} 不适用于武器 ${weapon.title}`,
    );
  }
}

function resolvePerkSet(
  context: BuildGuideResolutionContext,
  source: BuildGuideSource["perks"]["primary"],
  weapon: ResolvedBuildGuideWeapon,
  guideSlug: string,
): ResolvedBuildGuidePerkSet {
  return Object.fromEntries(
    BUILD_GUIDE_PERK_SLOTS.map((slot) => {
      const perkSlug = source[String(slot) as keyof typeof source];
      if (!perkSlug) return [slot, null];
      const perk = context.perks.get(perkSlug);
      if (!perk) throw buildGuideError(guideSlug, `插件不存在: ${perkSlug}`);
      if (perk.slot !== slot) {
        throw buildGuideError(
          guideSlug,
          `插件 ${perkSlug} 应位于 ${slot} 号槽，实际为 ${perk.slot} 号槽`,
        );
      }
      assertPerkAppliesToWeapon(perk, weapon, guideSlug);
      return [
        slot,
        {
          slug: perk.slug,
          name: perk.name,
          slot: perk.slot,
          icon: perk.icon,
          href: `/perks/${perk.slug
            .split("/")
            .map((part) => encodeURIComponent(part))
            .join("/")}`,
        },
      ];
    }),
  ) as ResolvedBuildGuidePerkSet;
}

export function resolveS3BuildTalent(
  source: BuildGuideSource["talent"],
  guideSlug: string,
): ResolvedBuildGuideTalent {
  const tree = S3_TREES[source.tree];
  const passive = S3_PASSIVES.find((candidate) => candidate.id === source.passive);
  if (!passive) {
    throw buildGuideError(guideSlug, `S3 被动天赋不存在: ${source.passive}`);
  }

  const treeHref = `/guides/season-talents/s3/${source.tree}`;
  const nodes = [...source.route].map((digit, index) => {
    const phase = index + 2;
    const column = Number(digit) + 4;
    const canonicalNode = SHARED_GENERAL_NODES.find(
      (node) => node.phase === phase && node.column === column,
    );
    if (!canonicalNode) {
      throw buildGuideError(
        guideSlug,
        `路线 ${source.route} 无法解析第 ${phase} 阶段`,
      );
    }
    const id =
      source.tree === "zero"
        ? canonicalNode.id
        : `shared-${tree.talentType}-${canonicalNode.id}`;
    return {
      id,
      canonicalId: canonicalNode.id,
      name: canonicalNode.name,
      icon: canonicalNode.icon,
      phase,
      level: canonicalNode.maxLevel,
      description:
        canonicalNode.descriptions[canonicalNode.maxLevel - 1] ??
        canonicalNode.descriptions.at(-1) ??
        "",
      href: `${treeHref}?node=${encodeURIComponent(id)}#season-talent-node-${encodeURIComponent(id)}`,
    };
  });

  const exclusivePoints = tree.nodes
    .filter((node, index) => index > 0 && node.column <= 3)
    .reduce((sum, node) => sum + node.maxLevel, 0);
  const generalPoints = nodes.reduce((sum, node) => sum + node.level, 0);

  return {
    tree: source.tree,
    treeName: tree.name,
    treeIcon: tree.nodes[0].icon,
    treeDescription: tree.nodes[0].descriptions.at(-1) ?? "",
    treeHref,
    passive: {
      id: passive.id,
      name: passive.name,
      icon: passive.icon,
      description: passive.description,
      href: `${treeHref}?passive=${encodeURIComponent(passive.id)}#season-talent-passive-${encodeURIComponent(passive.id)}`,
    },
    route: source.route,
    nodes,
    exclusivePoints,
    generalPoints,
    totalPoints: exclusivePoints + generalPoints,
  };
}

async function createResolutionContext(): Promise<BuildGuideResolutionContext> {
  const [weapons, perks] = await Promise.all([
    getAllResolvedWeapons("lc"),
    Promise.resolve(getAllPerks()),
  ]);
  return {
    weapons: new Map(weapons.map((weapon) => [weapon.slug, weapon])),
    perks: new Map(perks.map((perk) => [perk.slug, perk])),
  };
}

async function resolveParsedBuildGuide(
  source: BuildGuideSource,
  slug: string,
  content: string,
  context: BuildGuideResolutionContext,
): Promise<ResolvedBuildGuide> {
  const primary = resolveWeapon(context, source.weapons.primary, "主武器", slug);
  const secondary = resolveWeapon(context, source.weapons.secondary, "副武器", slug);
  const melee = resolveWeapon(context, source.weapons.melee, "近战武器", slug);

  return {
    slug,
    title: source.title,
    summary: source.summary,
    source: source.source,
    season: source.season,
    draft: source.draft,
    tags: source.tags,
    content,
    weapons: { primary, secondary, melee },
    perks: {
      primary: resolvePerkSet(context, source.perks.primary, primary, slug),
      secondary: resolvePerkSet(context, source.perks.secondary, secondary, slug),
    },
    talent: resolveS3BuildTalent(source.talent, slug),
  };
}

export async function resolveBuildGuideSource(
  metadata: unknown,
  slug = "test-guide",
  content = "",
): Promise<ResolvedBuildGuide> {
  const source = parseBuildGuideSource(metadata, slug);
  return resolveParsedBuildGuide(source, slug, content, await createResolutionContext());
}

function readBuildGuideFiles(): Array<{
  slug: string;
  metadata: unknown;
  content: string;
}> {
  if (!fs.existsSync(BUILD_GUIDE_DIRECTORY)) return [];
  return fs
    .readdirSync(BUILD_GUIDE_DIRECTORY)
    .filter((file) => file.endsWith(".mdx"))
    .sort((left, right) => left.localeCompare(right, "zh-CN"))
    .map((file) => {
      const parsed = matter(
        fs.readFileSync(path.join(BUILD_GUIDE_DIRECTORY, file), "utf8"),
      );
      return {
        slug: file.replace(/\.mdx$/, ""),
        metadata: parsed.data,
        content: parsed.content,
      };
    });
}

export async function getAllBuildGuides(options?: {
  includeDrafts?: boolean;
}): Promise<ResolvedBuildGuide[]> {
  const includeDrafts =
    options?.includeDrafts ?? process.env.NODE_ENV === "development";
  const documents = readBuildGuideFiles()
    .map((document) => ({
      ...document,
      source: parseBuildGuideSource(document.metadata, document.slug),
    }))
    .filter((document) => includeDrafts || !document.source.draft);
  const context = await createResolutionContext();
  return Promise.all(
    documents.map((document) =>
      resolveParsedBuildGuide(
        document.source,
        document.slug,
        document.content,
        context,
      ),
    ),
  );
}

export async function getBuildGuideSummaries(options?: {
  includeDrafts?: boolean;
}): Promise<BuildGuideSummary[]> {
  return (await getAllBuildGuides(options)).map(({ content, ...guide }) => {
    void content;
    return guide;
  });
}

export async function getBuildGuideBySlug(
  slug: string,
  options?: { includeDrafts?: boolean },
): Promise<ResolvedBuildGuide | null> {
  const decodedSlug = decodeURIComponent(slug);
  return (
    (await getAllBuildGuides(options)).find((guide) => guide.slug === decodedSlug) ??
    null
  );
}
