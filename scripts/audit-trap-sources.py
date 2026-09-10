"""Read official trap exports and print identity/level/ability evidence as JSON.

This does not infer runtime damage or modify site content. Missing fields in
Blueprint exports may be inherited; absence must not be interpreted as zero.
"""

import argparse
import json
from pathlib import Path


def read(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def asset_file(root, reference):
    package = reference.split(".")[0]
    package = package.removeprefix("/Game/").removeprefix("NZM/Content/")
    return root / (package + ".json")


def default_properties(path):
    return next((x.get("Properties", {}) for x in read(path)
                 if x.get("Name", "").startswith("Default__")), {})


def numeric_references(value):
    if isinstance(value, dict):
        return set().union(set(), *(numeric_references(v) for v in value.values()))
    if isinstance(value, list):
        return set().union(set(), *(numeric_references(v) for v in value))
    return {value} if isinstance(value, int) and value >= 100000000 else set()


def audit(root):
    table = root / "DataTables/TowerDefense"
    params = read(table / "TowerDefenseTrapParamTable.json")[0]["Rows"]
    levels = read(table / "TowerDefenseTowerLevelConfig.json")[0]["Rows"]
    ids = read(table / "TowerDefenseIDToParamKeyTable.json")[0]["Rows"]
    settlements = read(root / "DataTables/numerical_config_monsterskill.json")[0]["Rows"]
    modifiers = read(root / "Attributes/AutoGenerate/numerical_modifier_config.json")[0]["Rows"]
    result = []
    for key, row in params.items():
        if not key.startswith("TD_"):
            continue
        preset_path = asset_file(root, row["TrapSpawnPresetData"]["AssetPathName"])
        preset = read(preset_path)[0]["Properties"]["AISpawnProperty"]
        character_path = asset_file(root, preset["AICharacterClass"]["ObjectPath"])
        character = default_properties(character_path)
        tower_key = character.get("TowerKey")
        abilities = []
        for path in sorted(character_path.parent.rglob("*.json")):
            if "Ability" not in path.parts:
                continue
            properties = default_properties(path)
            if properties:
                abilities.append({"source": str(path.relative_to(root)),
                                  "properties": properties})
        referenced_ids = numeric_references(abilities)
        result.append({
            "paramKey": key,
            "name": row["FriendlyName"]["SourceString"],
            "towerIds": [r["TowerId"] for r in ids.values() if r["RowName"] == key],
            "coinCost": row["CoinCost"],
            "placeType": row["PlaceTypeRestrict"],
            "presetSource": str(preset_path.relative_to(root)),
            "characterSource": str(character_path.relative_to(root)),
            "towerKey": tower_key,
            "npcAttributeId": character.get("NPCAttributeID"),
            "characterDefaults": character,
            "levels": {k: {f: v[f] for f in ("UpgradeKey", "SpellPower", "MaxHealth")}
                       for k, v in levels.items() if tower_key and k.startswith(tower_key + "_")},
            "abilities": abilities,
            "referencedSettlements": {k: v for k, v in settlements.items()
                                      if v.get("id") in referenced_ids},
            "referencedModifiers": {k: v for k, v in modifiers.items()
                                    if v.get("ID") in referenced_ids},
            "caveat": "SpellPower is a configured stat, not automatically final damage; ability defaults may inherit omitted fields.",
        })
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1] / "refs/Exports/NZM/Content")
    parser.add_argument("--output", type=Path, help="Optional local evidence JSON; otherwise stdout")
    args = parser.parse_args()
    records = audit(args.root)
    encoded = json.dumps(records, ensure_ascii=False, indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(encoded + "\n", encoding="utf-8")
        print(f"Extracted {len(records)} trap identities to {args.output}")
    else:
        print(encoded)
