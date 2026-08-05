import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";
import matter from "gray-matter";
import {
  createResolvedWeaponSnapshot,
  resolveWeapon,
  type ResolvedWeaponSnapshot,
} from "../../lib/weapon-resolver";
import { readWeaponDataLock } from "./lock";

export const PILOT_SNAPSHOT_PATH = path.join(
  process.cwd(),
  "data",
  "weapon-v2-pilot-snapshots.json",
);

export const WEAPON_V2_PILOTS = Object.freeze([
  {
    key: "lc:星海狂想",
    table: "lc",
    file: "data/weapons/星海狂想.mdx",
    sourceIdMap: {
      "v1-mode-0": "primary-fire",
      "v1-extra-0": "passive-max-rate",
      "v1-extra-1": "large-ice-spike",
      "v1-extra-2": "frost-ice-spike",
    },
  },
  {
    key: "td:星海狂想",
    table: "td",
    file: "data/weapons_td/星海狂想.mdx",
    sourceIdMap: {
      "v1-mode-0": "primary-fire",
      "v1-extra-0": "passive-max-rate",
      "v1-extra-1": "large-ice-spike",
      "v1-extra-2": "frost-ice-spike",
    },
  },
  {
    key: "lc:飓风之龙",
    table: "lc",
    file: "data/weapons/飓风之龙.mdx",
    sourceIdMap: {
      "v1-primary": "shotgun",
      "v1-mode-1": "dragon-flame-hit",
      "v1-extra-0": "dragon-flame-explosion",
      "v1-extra-1": "seeking-dragon-flame",
      "v1-extra-2": "shotgun-burst",
      "v1-extra-3": "dragon-flame-burst",
    },
  },
  {
    key: "td:飓风之龙",
    table: "td",
    file: "data/weapons_td/飓风之龙.mdx",
    sourceIdMap: {
      "v1-primary": "shotgun",
      "v1-mode-1": "dragon-flame-hit",
      "v1-extra-0": "dragon-flame-explosion",
      "v1-extra-1": "seeking-dragon-flame",
      "v1-extra-2": "shotgun-burst",
      "v1-extra-3": "dragon-flame-burst",
    },
  },
  {
    key: "lc:幽冥毒皇",
    table: "lc",
    file: "data/weapons/幽冥毒皇.mdx",
    sourceIdMap: {
      "v1-primary": "machine-gun",
      "v1-mode-1": "grenade-hit",
      "v1-mode-2": "grenade-explosion",
      "v1-extra-0": "poison-pool-dot",
    },
  },
  {
    key: "td:幽冥毒皇",
    table: "td",
    file: "data/weapons_td/幽冥毒皇.mdx",
    sourceIdMap: {
      "v1-primary": "machine-gun",
      "v1-mode-1": "grenade-hit",
      "v1-mode-2": "grenade-explosion",
      "v1-extra-0": "poison-pool-dot",
    },
  },
  {
    key: "lc:军用手斧",
    table: "lc",
    file: "data/weapons/军用手斧.mdx",
    sourceIdMap: { "v1-mode-0": "heavy-hit" },
  },
  {
    key: "td:军用手斧",
    table: "td",
    file: "data/weapons_td/军用手斧.mdx",
    sourceIdMap: { "v1-mode-0": "heavy-hit" },
  },
  {
    key: "lc:木葫芦",
    table: "lc",
    file: "data/weapons/木葫芦.mdx",
    sourceIdMap: {},
  },
  {
    key: "td:木葫芦",
    table: "td",
    file: "data/weapons_td/木葫芦.mdx",
    sourceIdMap: {},
  },
] as const);

export type PilotDiffClassification =
  | "structural"
  | "source_difference"
  | "accepted_correction"
  | "consumer_pending";

export interface PilotSnapshotDiff {
  readonly pointer: string;
  readonly operation: "add" | "remove" | "replace";
  readonly before?: unknown;
  readonly after?: unknown;
  readonly classification: PilotDiffClassification;
  readonly reason: string;
}

export interface WeaponPilotSnapshotFile {
  readonly schema_version: 1;
  readonly baseline: Readonly<Record<string, ResolvedWeaponSnapshot>>;
  readonly after?: Readonly<Record<string, ResolvedWeaponSnapshot>>;
  readonly differences?: Readonly<Record<string, readonly PilotSnapshotDiff[]>>;
}

function escapePointer(value: string): string {
  return value.replaceAll("~", "~0").replaceAll("/", "~1");
}

function sortedValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortedValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right, "en"))
        .map(([key, child]) => [key, sortedValue(child)]),
    );
  }
  return value;
}

function serialize(value: unknown): string {
  return `${JSON.stringify(sortedValue(value), null, 2)}\n`;
}

function snapshotPilots(options: { requireVersion: 1 | 2 }): Record<string, ResolvedWeaponSnapshot> {
  const lock = options.requireVersion === 2 ? readWeaponDataLock() : undefined;
  const snapshots: Record<string, ResolvedWeaponSnapshot> = {};
  for (const pilot of WEAPON_V2_PILOTS) {
    const absolutePath = path.resolve(pilot.file);
    const data = matter(readFileSync(absolutePath, "utf8")).data;
    const actualVersion = data.schema_version === 2 ? 2 : 1;
    if (actualVersion !== options.requireVersion) {
      throw new Error(
        `${pilot.file}: expected schema version ${options.requireVersion}, got ${actualVersion}`,
      );
    }
    const resolved = resolveWeapon(data, {
      slug: path.basename(pilot.file, ".mdx"),
      expectedTable: pilot.table,
      lock,
    });
    snapshots[pilot.key] = createResolvedWeaponSnapshot(resolved, {
      sourceIdMap: options.requireVersion === 1 ? pilot.sourceIdMap : undefined,
    });
  }
  return snapshots;
}

interface RawDiff {
  pointer: string;
  operation: "add" | "remove" | "replace";
  before?: unknown;
  after?: unknown;
}

function diffValues(before: unknown, after: unknown, pointer = ""): RawDiff[] {
  if (isDeepStrictEqual(before, after)) return [];
  if (Array.isArray(before) && Array.isArray(after)) {
    const result: RawDiff[] = [];
    const length = Math.max(before.length, after.length);
    for (let index = 0; index < length; index += 1) {
      const childPointer = `${pointer}/${index}`;
      if (index >= before.length) {
        result.push({ pointer: childPointer, operation: "add", after: after[index] });
      } else if (index >= after.length) {
        result.push({ pointer: childPointer, operation: "remove", before: before[index] });
      } else {
        result.push(...diffValues(before[index], after[index], childPointer));
      }
    }
    return result;
  }
  if (
    before &&
    after &&
    typeof before === "object" &&
    typeof after === "object" &&
    !Array.isArray(before) &&
    !Array.isArray(after)
  ) {
    const left = before as Record<string, unknown>;
    const right = after as Record<string, unknown>;
    const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort((a, b) =>
      a.localeCompare(b, "en"),
    );
    const result: RawDiff[] = [];
    for (const key of keys) {
      const childPointer = `${pointer}/${escapePointer(key)}`;
      if (!(key in left)) {
        result.push({ pointer: childPointer, operation: "add", after: right[key] });
      } else if (!(key in right)) {
        result.push({ pointer: childPointer, operation: "remove", before: left[key] });
      } else {
        result.push(...diffValues(left[key], right[key], childPointer));
      }
    }
    return result;
  }
  return [{ pointer: pointer || "/", operation: "replace", before, after }];
}

function reviewedReason(key: string, diff: RawDiff): Omit<PilotSnapshotDiff, keyof RawDiff> {
  const pointer = diff.pointer;
  const structuralTokens = [
    "/provenance",
    "/overrideHistory",
    "/settlements",
    "/unknownSettlements",
    "/diagnostics",
    "/schemaVersion",
    "/mainSourceId",
  ];
  if (structuralTokens.some((token) => pointer.includes(token))) {
    return {
      classification: "structural",
      reason: `Reviewed V1-to-V2 structural trace change at ${pointer}`,
    };
  }
  if (
    key.includes("星海狂想") &&
    pointer.includes("/damageSources/1/fire/")
  ) {
    return {
      classification: "accepted_correction",
      reason: "Reviewed passive maximum-rate ASC override and derived RPM",
    };
  }
  if (
    key.includes("星海狂想") &&
    pointer.includes("/damageSources/2/damage/flesh")
  ) {
    return {
      classification: "accepted_correction",
      reason: "Settlement omits Flesh.Base, so zero becomes not_applicable",
    };
  }
  if (
    key.includes("幽冥毒皇") &&
    pointer.includes("/damageSources/3/damage/")
  ) {
    return {
      classification: "accepted_correction",
      reason: "DebuffDamage Settlement makes non-health Dot fields not_applicable",
    };
  }
  if (
    key.includes("幽冥毒皇") &&
    pointer.includes("/damageSources/0/fire/")
  ) {
    return {
      classification: "accepted_correction",
      reason: "Reviewed exact ASC 223 interval replacing rounded V1 interval",
    };
  }
  if (key.includes("军用手斧") && pointer.includes("/damageSources")) {
    return {
      classification: "accepted_correction",
      reason: "Reviewed authoritative heavy hit and explicit left/right light hit split",
    };
  }
  if (key.includes("木葫芦") && pointer.includes("/damageSources")) {
    return {
      classification: "structural",
      reason: "V2 empty damage_sources removes the synthetic V1 attack source",
    };
  }
  if (
    pointer.includes("/fire/interval") ||
    pointer.includes("/fire/rpm")
  ) {
    return {
      classification: "accepted_correction",
      reason: "Reviewed ASC-backed or Numerical-only fire timing state transition",
    };
  }
  if (pointer.endsWith("/state") || pointer.endsWith("/status") || pointer.endsWith("/value")) {
    return {
      classification: "source_difference",
      reason: `Reviewed source-backed value/state difference at ${pointer}`,
    };
  }
  return {
    classification: "structural",
    reason: `Reviewed V1-to-V2 shape change at ${pointer}`,
  };
}

function buildDifferences(
  baseline: Readonly<Record<string, ResolvedWeaponSnapshot>>,
  after: Readonly<Record<string, ResolvedWeaponSnapshot>>,
): Record<string, PilotSnapshotDiff[]> {
  return Object.fromEntries(
    WEAPON_V2_PILOTS.map((pilot) => {
      const raw = diffValues(baseline[pilot.key], after[pilot.key]);
      return [
        pilot.key,
        raw.map((diff) => ({ ...diff, ...reviewedReason(pilot.key, diff) })),
      ];
    }),
  );
}

export function capturePilotBaseline(outputPath = PILOT_SNAPSHOT_PATH): void {
  const value: WeaponPilotSnapshotFile = {
    schema_version: 1,
    baseline: snapshotPilots({ requireVersion: 1 }),
  };
  writeFileSync(outputPath, serialize(value), "utf8");
}

export function refreshPilotSnapshots(outputPath = PILOT_SNAPSHOT_PATH): void {
  const current = JSON.parse(readFileSync(outputPath, "utf8")) as WeaponPilotSnapshotFile;
  const after = snapshotPilots({ requireVersion: 2 });
  const value: WeaponPilotSnapshotFile = {
    schema_version: 1,
    baseline: current.baseline,
    after,
    differences: buildDifferences(current.baseline, after),
  };
  writeFileSync(outputPath, serialize(value), "utf8");
}

export function checkPilotSnapshots(inputPath = PILOT_SNAPSHOT_PATH): void {
  const expected = JSON.parse(readFileSync(inputPath, "utf8")) as WeaponPilotSnapshotFile;
  if (!expected.after || !expected.differences) {
    throw new Error("pilot snapshot file has no reviewed after snapshot");
  }
  const after = snapshotPilots({ requireVersion: 2 });
  const differences = buildDifferences(expected.baseline, after);
  if (!isDeepStrictEqual(sortedValue(after), sortedValue(expected.after))) {
    throw new Error("current pilot snapshots differ from the reviewed after snapshots");
  }
  if (!isDeepStrictEqual(sortedValue(differences), sortedValue(expected.differences))) {
    throw new Error("current pilot JSON Pointer differences differ from the reviewed allowlist");
  }
}

function main(): void {
  const command = process.argv[2];
  if (command === "capture-baseline") {
    capturePilotBaseline();
    console.log(`Captured V1 pilot baseline: ${PILOT_SNAPSHOT_PATH}`);
    return;
  }
  if (command === "refresh") {
    refreshPilotSnapshots();
    console.log(`Refreshed V2 pilot snapshots: ${PILOT_SNAPSHOT_PATH}`);
    return;
  }
  if (command === "check") {
    checkPilotSnapshots();
    console.log("Weapon V2 pilot snapshots match the reviewed JSON Pointer allowlist.");
    return;
  }
  throw new Error("usage: pilot-migration.ts <capture-baseline|refresh|check>");
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  main();
}
