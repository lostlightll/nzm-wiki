import test from "node:test";
import assert from "node:assert/strict";
import { getLegacyTalentCatalog } from "./s0s1-season-talents";
import { isLegacyExclusiveNode, legacyNodePosition, legacyViewStorageKey, restoreLegacyTalentView } from "./s0s1-talent-view";

const nodes = [{id:"root",isRoot:true,maxLevel:1},{id:"child",isRoot:false,maxLevel:3}];
test("all published trees keep passive nodes left and a larger exclusive region right", () => {
  for (const season of ["s0", "s1"] as const) for (const tree of getLegacyTalentCatalog(season)) {
    const positions = tree.nodes.filter(node => !node.isRoot).map(node => ({ node, ...legacyNodePosition(season, node) }));
    for (const position of positions) {
      assert.ok(position.x >= 45 && position.x <= 850 && position.y <= 750, `${tree.id}/${position.node.id}`);
      const exclusive = isLegacyExclusiveNode(season, position.node.column);
      const localX = exclusive ? (position.x - 360) / 540 : position.x / 340;
      assert.ok(localX >= .1 && localX <= .9, "node boxes stay within their region");
      assert.ok(position.y / 800 >= .125 && position.y / 800 <= .875, "reserve title and label space on short screens");
      for (const id of position.node.afterIds) {
        const target = tree.nodes.find(node => node.id === id);
        if (target && !target.isRoot) assert.equal(isLegacyExclusiveNode(season, target.column), exclusive, "partitioning must not drop cross-region connectors");
      }
      for (const other of positions) {
        if (other.node.id === position.node.id) continue;
        assert.ok(Math.abs(other.x - position.x) >= 80 || Math.abs(other.y - position.y) >= 110, `${tree.id}: ${position.node.id} overlaps ${other.node.id}`);
      }
    }
  }
});
test("invalid or obsolete view state returns the root",()=>{
  for(const saved of [null,{},[],{version:2,nodeId:"child",level:1},{version:1,nodeId:"missing",level:2},{version:1,nodeId:"child",level:NaN},{version:1,nodeId:"child",level:"2"}]) assert.deepEqual(restoreLegacyTalentView(nodes,saved),{version:1,nodeId:"root",level:1});
});
test("same-column nodes stay aligned across every phase in all six trees", () => {
  for (const season of ["s0", "s1"] as const) for (const tree of getLegacyTalentCatalog(season)) {
    const columns = new Map<number, number>();
    for (const node of tree.nodes) {
      const { x } = legacyNodePosition(season, node);
      if (columns.has(node.column)) assert.equal(x, columns.get(node.column), `${tree.id}/${node.id}`);
      columns.set(node.column, x);
    }
  }
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
test("S1 passive tracks are evenly spaced with the branching root centered over its children", () => {
  const x = (column: number) => legacyNodePosition("s1", { column, phase: 3 }).x;
  assert.equal(x(2) - x(1), x(4) - x(2));
  assert.equal(x(3), (x(2) + x(4)) / 2);
});
test("layout reserves fixed node bounds without overlapping tracks",()=>{
  for(const season of ["s0","s1"] as const) for(let phase=1;phase<=7;phase++) for(const column of season === "s0" ? [1,2,4,6,8] : [1,2,3,4,5,7,9]) {
    const p=legacyNodePosition(season,{phase,column});
    assert.ok(p.x>=45 && p.x<=855 && p.y>=50 && p.y<=750);
    assert.equal(p.x>360,isLegacyExclusiveNode(season,column));
  }
  assert.throws(()=>legacyNodePosition("s1",{phase:8,column:7}));
  assert.throws(()=>legacyNodePosition("s0",{phase:2,column:3}));
});
test("S0 and S1 retain their different common/exclusive column boundaries",()=>{
  assert.equal(isLegacyExclusiveNode("s0",4),true);
  assert.equal(isLegacyExclusiveNode("s0",2),false);
  assert.equal(isLegacyExclusiveNode("s1",4),false);
  assert.equal(isLegacyExclusiveNode("s1",5),true);
});
