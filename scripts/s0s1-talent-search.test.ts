import test from "node:test";
import assert from "node:assert/strict";
import { createSeasonTalentSearchItem } from "./generate-search-index";
import { getLegacyTalentCatalog } from "../lib/s0s1-season-talents";
import { LEGACY_TALENT_CATALOG, legacyTalentHref } from "../lib/s0s1-talent-presentation";

test("every legacy branch and node has a consistent navigable search identity",()=>{
  for(const season of ["s0","s1"] as const) {
    const trees=getLegacyTalentCatalog(season);
    for(const tree of trees) {
      assert.ok(LEGACY_TALENT_CATALOG.some(t=>t.season===season && t.id===tree.id && t.name===tree.name));
      for(const node of tree.nodes) {
        const item=createSeasonTalentSearchItem({season,tree:tree.id,treeName:tree.name,id:node.id,title:node.name,kind:"node",keywords:[]});
        assert.equal(item.path,`${legacyTalentHref(season,tree.id)}?node=${node.id}#season-talent-node-${node.id}`);
        assert.ok(item.keywords.includes(season.toUpperCase()));
      }
    }
  }
});
