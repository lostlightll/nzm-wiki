import test from "node:test";
import assert from "node:assert/strict";
import { isLegacyExclusiveNode, legacyNodePosition, legacyViewStorageKey, restoreLegacyTalentView } from "./s0s1-talent-view";

const nodes = [{id:"root",isRoot:true,maxLevel:1},{id:"child",isRoot:false,maxLevel:3}];
test("invalid or obsolete view state returns the root",()=>{
  for(const saved of [null,{},[],{version:2,nodeId:"child",level:1},{version:1,nodeId:"missing",level:2},{version:1,nodeId:"child",level:NaN},{version:1,nodeId:"child",level:"2"}]) assert.deepEqual(restoreLegacyTalentView(nodes,saved),{version:1,nodeId:"root",level:1});
});
test("level previews clamp to exact node levels",()=>{
  assert.equal(restoreLegacyTalentView(nodes,{version:1,nodeId:"child",level:99}).level,3);
  assert.equal(restoreLegacyTalentView(nodes,{version:1,nodeId:"child",level:-2}).level,1);
  assert.equal(restoreLegacyTalentView(nodes,{version:1,nodeId:"child",level:2.9}).level,2);
});
test("view storage is isolated by season and branch",()=>{
  assert.notEqual(legacyViewStorageKey("s0","one"),legacyViewStorageKey("s1","one"));
  assert.notEqual(legacyViewStorageKey("s0","one"),legacyViewStorageKey("s0","two"));
});
test("layout reserves fixed node bounds without overlapping tracks",()=>{
  for(let phase=1;phase<=7;phase++) for(let column=1;column<=9;column++) {
    const p=legacyNodePosition({phase,column});
    assert.ok(p.x>=45 && p.x<=805 && p.y>=34 && p.y<=810);
  }
  assert.throws(()=>legacyNodePosition({phase:8,column:7}));
});
test("S0 and S1 retain their different common/exclusive column boundaries",()=>{
  assert.equal(isLegacyExclusiveNode("s0",4),true);
  assert.equal(isLegacyExclusiveNode("s0",2),false);
  assert.equal(isLegacyExclusiveNode("s1",4),false);
  assert.equal(isLegacyExclusiveNode("s1",5),true);
});
