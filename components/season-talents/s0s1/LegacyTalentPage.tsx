import fs from "node:fs";
import path from "node:path";
import { notFound } from "next/navigation";
import { getLegacyTalentTree } from "@/lib/s0s1-season-talents";
import { LegacyTalentBuilder } from "./LegacyTalentBuilder";

export function LegacyTalentPage({season,id}:{season:string;id:string}) {
  const tree=getLegacyTalentTree(season,id);
  if(!tree) notFound();
  const assetDirectory=path.join(process.cwd(),"public/webp/images/season-talents/s0s1");
  const exportedIcons=new Set(fs.readdirSync(assetDirectory).map(name=>`/webp/images/season-talents/s0s1/${name}`));
  const availableIcons=[...new Set(tree.nodes.map(n=>n.icon))].filter(icon=>exportedIcons.has(icon));
  return <LegacyTalentBuilder key={`${season}:${id}`} tree={tree} availableIcons={availableIcons}/>;
}
