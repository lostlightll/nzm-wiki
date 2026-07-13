import path from "node:path";
import { pathToFileURL } from "node:url";
import { readContentCatalog, type ContentDocument } from "./content-catalog";
import { getContentRouteRule, resolveContentPath } from "./content-routes";

const PAGE_WIDTHS = new Set(["sm", "md", "lg", "xl", "2xl", "3xl", "full"]);
const CUSTOM_WIDTH = /^\d+(px|rem|em|vw|%)$/;
const WEAPON_USE_TYPES = new Set(["主武器", "副武器", "近战武器"]);
const WEAPON_RARITIES = new Set(["稀有", "史诗", "传说"]);
const WEAPON_ELEMENTS = new Set(["物理", "腐蚀", "寒冷", "电弧", "火焰"]);
const COMMON_FIELDS = [
  "date",
  "draft",
  "keywords",
  "page-width",
  "title",
  "toc",
  "updated",
] as const;
const CONTENT_FIELDS: Record<string, readonly string[]> = {
  cards: ["effect", "icon", "tag", "type"],
  enemies: [
    "ap",
    "attack",
    "attack_range",
    "description",
    "en",
    "hardstraight_hp",
    "hitMoney",
    "hitback_hp",
    "hp",
    "hp2",
    "killMoney",
    "kill_money",
    "map",
    "nickname",
    "search_range",
    "speed",
    "totalMoney",
    "type",
    "weight",
  ],
  perks: ["description", "icon", "id", "rarity", "season", "slot", "weaponType"],
  posts: ["tag"],
  traps: ["area", "attack", "description", "hp", "nickname", "position", "price", "range"],
  weapons: [
    "accuracy",
    "active_skill_id",
    "asc_type_id",
    "attenuation_begin",
    "attenuation_end",
    "attenuation_scale",
    "changeClip",
    "damage",
    "damage_label",
    "damage_label_text",
    "damage_modes",
    "element",
    "element_add_rate",
    "enable_critical",
    "explosion_range",
    "extra_modes",
    "file_rate",
    "game_mode",
    "ignore_shield",
    "magazine",
    "melee_damage",
    "mode_names",
    "nickname",
    "pellets",
    "prototype_id",
    "range",
    "rarity",
    "reload_time",
    "scope",
    "shooting_energy",
    "shooting_energy_count",
    "show_duration",
    "skill_blocking",
    "skill_cooldown",
    "skill_duration",
    "stability",
    "tags",
    "total_ammo",
    "toughness_type",
    "use_type",
    "weakness_multiplier",
    "weapon_type",
    "weapon_type_id",
    "weekness_multiplier",
  ],
};

function describeFile(document: ContentDocument): string {
  return path.relative(process.cwd(), document.filePath);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isStringOrNumber(value: unknown): boolean {
  return typeof value === "string" || typeof value === "number";
}

function validateTypedFields(document: ContentDocument): string[] {
  const errors: string[] = [];
  const file = describeFile(document);
  const data = document.metadata;
  const root = document.slug.split("/")[0];
  const error = (field: string, expectation: string): void => {
    errors.push(`${file}: frontmatter.${field} ${expectation}`);
  };
  const requireString = (field: string): void => {
    if (typeof data[field] !== "string" || data[field].trim() === "") {
      error(field, "must be a non-empty string");
    }
  };
  const requireStringType = (field: string): void => {
    if (typeof data[field] !== "string") error(field, "must be a string");
  };

  const fieldGroup = root === "weapons_td" ? "weapons" : root;
  const allowedFields = new Set([
    ...COMMON_FIELDS,
    ...(CONTENT_FIELDS[fieldGroup] ?? []),
  ]);
  for (const field of Object.keys(data)) {
    if (!allowedFields.has(field)) {
      error(field, "is not a recognized field");
    }
  }

  if (root === "weapons" || root === "weapons_td") {
    if (!WEAPON_USE_TYPES.has(String(data.use_type))) {
      error("use_type", "must be 主武器, 副武器, or 近战武器");
    }
    if (!WEAPON_RARITIES.has(String(data.rarity))) {
      error("rarity", "must be 稀有, 史诗, or 传说");
    }
    if (!WEAPON_ELEMENTS.has(String(data.element))) {
      error("element", "must be a supported element");
    }
    if (
      data.weapon_type !== null &&
      (typeof data.weapon_type !== "string" || data.weapon_type === "")
    ) {
      error("weapon_type", "must be a string or null");
    }
    if (
      data.damage !== null &&
      (typeof data.damage !== "object" || Array.isArray(data.damage))
    ) {
      error("damage", "must be an object or null");
    }
    if (root === "weapons_td" && data.game_mode !== "td") {
      error("game_mode", "must be td for tower-defense weapons");
    }
  } else if (root === "perks") {
    if (![1, 2, 3, 4].includes(Number(data.slot))) {
      error("slot", "must be an integer from 1 to 4");
    }
    if (![1, 2, 3].includes(Number(data.rarity))) {
      error("rarity", "must be 1, 2, or 3");
    }
    requireString("icon");
    requireStringType("description");
  } else if (root === "traps") {
    for (const field of ["position", "attack", "area", "description"]) {
      requireStringType(field);
    }
    if (!isStringOrNumber(data.range)) error("range", "must be a string or number");
    if (!isStringOrNumber(data.price)) error("price", "must be a string or number");
    if (data.hp !== null && !isStringOrNumber(data.hp)) {
      error("hp", "must be a string, number, or null");
    }
  } else if (root === "enemies") {
    if (!isStringOrNumber(data.hp)) error("hp", "must be a string or number");
  } else if (root === "posts") {
    if (typeof data.tag !== "string" && !isStringArray(data.tag)) {
      error("tag", "must be a string or string[]");
    }
  } else if (root === "cards") {
    if (data.type !== "buff" && data.type !== "debuff") {
      error("type", "must be buff or debuff");
    }
    for (const field of ["icon", "effect", "tag"]) requireString(field);
  }

  return errors;
}

export function validateContentCatalog(
  documents = readContentCatalog(),
): string[] {
  const errors: string[] = [];
  const publishedUrls = new Map<string, string>();

  for (const document of documents) {
    const file = describeFile(document);
    const { metadata } = document;
    const title = metadata.title;

    if (typeof title !== "string" || title.trim() === "") {
      errors.push(`${file}: frontmatter.title must be a non-empty string`);
    }

    errors.push(...validateTypedFields(document));

    if (
      (metadata.updated !== undefined || metadata.date !== undefined) &&
      !document.lastModified
    ) {
      errors.push(`${file}: frontmatter.updated/date must be a valid date`);
    }

    for (const key of ["draft", "toc"] as const) {
      if (metadata[key] !== undefined && typeof metadata[key] !== "boolean") {
        errors.push(`${file}: frontmatter.${key} must be a boolean`);
      }
    }

    const pageWidth = metadata["page-width"];
    if (
      pageWidth !== undefined &&
      (typeof pageWidth !== "string" ||
        (!PAGE_WIDTHS.has(pageWidth) && !CUSTOM_WIDTH.test(pageWidth)))
    ) {
      errors.push(`${file}: frontmatter.page-width is not supported`);
    }

    const keywords = metadata.keywords;
    if (
      keywords !== undefined &&
      typeof keywords !== "string" &&
      !isStringArray(keywords)
    ) {
      errors.push(`${file}: frontmatter.keywords must be a string or string[]`);
    }

    const tags = metadata.tags;
    if (
      tags !== undefined &&
      tags !== null &&
      typeof tags !== "string" &&
      !isStringArray(tags)
    ) {
      errors.push(`${file}: frontmatter.tags must be a string or string[]`);
    }

    const routeRule = getContentRouteRule(document.slug);
    if (!routeRule) {
      errors.push(`${file}: no content route rule matches slug ${document.slug}`);
      continue;
    }
    const url = resolveContentPath(document.slug);
    if (!url) continue;

    if (metadata.draft === true) continue;

    const duplicate = publishedUrls.get(url);
    if (duplicate) {
      errors.push(`${file}: published URL ${url} is already used by ${duplicate}`);
    } else {
      publishedUrls.set(url, file);
    }
  }

  return errors;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  const errors = validateContentCatalog();
  if (errors.length > 0) {
    console.error(`Content validation failed with ${errors.length} error(s):`);
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
  } else {
    console.log("Content validation passed.");
  }
}
