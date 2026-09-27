export type OriginTalentBranchId = 1 | 2 | 3 | 4;

export interface OriginTalent {
  id: string;
  name: string;
  description: string;
  branchId: OriginTalentBranchId;
  row: number;
  icon: string;
  maxLevel: number;
  prerequisites: { id: string; level: number }[];
  requiredTotalLevels: number;
  levels: { level: number; description: string; cost: number; sourceRow: string; affixId: number }[];
}

export interface OriginTalentCatalog {
  schemaVersion: 1;
  branches: { id: Exclude<OriginTalentBranchId, 4>; name: string }[];
  talents: OriginTalent[];
}
