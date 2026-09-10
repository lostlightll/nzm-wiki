"""Print decoded Blueprint expressions compactly, retaining statement offsets.

This is a display helper, not a decompiler or execution proof. Branches and
native function semantics must be checked against the original JSON.
"""
import argparse
import json
from pathlib import Path


def compact(value):
    if isinstance(value, list):
        return [compact(item) for item in value]
    if not isinstance(value, dict):
        return value
    if "Property" in value and "Owner" in value:
        return value["Property"].get("Name")
    if "ObjectName" in value:
        return value["ObjectName"]
    if "Path" in value and "ResolvedOwner" in value:
        return ".".join(value["Path"])
    return {key: compact(item) for key, item in value.items()
            if key not in ("ObjectPath", "StatementIndex")}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("path", type=Path)
    parser.add_argument("--function", default="", help="Function name substring")
    parser.add_argument("--match", default="", help="Only expressions containing this text")
    args = parser.parse_args()
    for export in json.loads(args.path.read_text(encoding="utf-8-sig")):
        if args.function not in export["Name"] or not export.get("ScriptBytecode"):
            continue
        print("FUNCTION", export["Name"])
        for expression in export["ScriptBytecode"]:
            text = json.dumps(compact(expression), ensure_ascii=False)
            if args.match in text:
                print(expression.get("StatementIndex", "?"), text)
