export const PERK_GUIDE_STORAGE_KEY = "nzm-wiki:perk-guide:v1";
export type PerkGuideVersion = "s3.2" | "s4";
const VIEW_LIMITS: Record<PerkGuideVersion, number> = { "s3.2": 3, s4: 10 };

function storageKey(version: PerkGuideVersion) {
  return version === "s3.2" ? PERK_GUIDE_STORAGE_KEY : `${PERK_GUIDE_STORAGE_KEY}:${version}`;
}
type GuideState = { views: number; dismissed: boolean };
type GuideStorage = Pick<Storage, "getItem" | "setItem">;

function readState(storage: GuideStorage, version: PerkGuideVersion): GuideState {
  try {
    const value = JSON.parse(storage.getItem(storageKey(version)) ?? "null");
    return {
      views: Number.isInteger(value?.views) && value.views >= 0 ? value.views : 0,
      dismissed: value?.dismissed === true,
    };
  } catch {
    return { views: 0, dismissed: false };
  }
}

/** Each version tracks its own displays and dismissal preference. */
export function recordPerkGuideVisit(storage: GuideStorage, version: PerkGuideVersion): boolean {
  const state = readState(storage, version);
  if (state.dismissed || state.views >= VIEW_LIMITS[version]) return false;
  storage.setItem(storageKey(version), JSON.stringify({ ...state, views: state.views + 1 }));
  return true;
}

export function setPerkGuideDismissed(storage: GuideStorage, version: PerkGuideVersion, dismissed: boolean) {
  storage.setItem(storageKey(version), JSON.stringify({ ...readState(storage, version), dismissed }));
}
