"use client";

import { ArrowDown, HelpCircle, Info } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { LegacyTalentNode, LegacyTalentTree } from "@/lib/s0s1-season-talents";
import { LEGACY_TALENT_CATALOG, legacyAsset, legacyPresentation } from "@/lib/s0s1-talent-presentation";
import { isLegacyExclusiveNode, legacyNodePosition, legacyViewStorageKey, restoreLegacyTalentView, type LegacyTalentView } from "@/lib/s0s1-talent-view";
import { getAssetPath } from "@/lib/path";
import { TalentConnectorLines, TalentDetails, TalentHeader, TalentNode, TalentWorkspace } from "@/components/season-talents/TalentEditor";
import { LegacyTalentScene } from "./LegacyTalentScene";
import styles from "./legacy-talents.module.css";

function LegacyGlyph({ node, availableIcons, large = false }: { node: LegacyTalentNode; availableIcons: string[]; large?: boolean }) {
  return <span className={large ? styles.largeGlyph : styles.glyph}>
    {availableIcons.includes(node.icon)
      ? <span aria-hidden="true" className={styles.iconGlyph} style={{ maskImage: `url("${getAssetPath(node.icon)}")` }} />
      : <HelpCircle size={large ? 64 : 28} aria-label="图标待定位" />}
  </span>;
}

export function LegacyTalentBuilder({ tree, availableIcons }: { tree: LegacyTalentTree; availableIcons: string[] }) {
  const presentation = legacyPresentation(tree.season, tree.id)!;
  const [view, setView] = useState<LegacyTalentView>(() => restoreLegacyTalentView(tree.nodes, null));
  const detailRef = useRef<HTMLElement>(null);
  const treeRef = useRef<HTMLDivElement>(null);
  const storageKey = legacyViewStorageKey(tree.season, tree.id);
  const node = tree.nodes.find(n => n.id === view.nodeId) ?? tree.nodes[0];
  const level = node.levels.find(l => l.level === view.level) ?? node.levels[0];
  const displayFacts = level.facts.filter(fact => fact.displayValue);
  const branchLinks = LEGACY_TALENT_CATALOG.filter(t => t.season === tree.season && (t.confirmed || t.id === tree.id)).map(t => ({ id: t.id, name: t.confirmed ? t.name : `${t.name} · 存档` }));
  const treeNodes = tree.nodes.filter(n => !n.isRoot);

  useEffect(() => {
    function sync() {
      let saved: unknown = null;
      try { saved = JSON.parse(window.localStorage.getItem(storageKey) ?? "null"); } catch { /* Storage is optional. */ }
      const requested = new URLSearchParams(window.location.search).get("node");
      const restored = restoreLegacyTalentView(tree.nodes, saved);
      setView(requested && requested !== restored.nodeId && tree.nodes.some(n => n.id === requested) ? restoreLegacyTalentView(tree.nodes, { version: 1, nodeId: requested, level: 1 }) : restored);
    }
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [storageKey, tree.nodes]);

  function update(next: LegacyTalentView, focusDetail = false) {
    const normalized = restoreLegacyTalentView(tree.nodes, next);
    setView(normalized);
    try { window.localStorage.setItem(storageKey, JSON.stringify(normalized)); } catch { /* Browsing works without persistence. */ }
    const url = new URL(window.location.href);
    url.searchParams.set("node", normalized.nodeId);
    url.hash = "";
    window.history.replaceState(window.history.state, "", url);
    if (focusDetail && window.matchMedia("(max-width: 1023px)").matches) detailRef.current?.scrollIntoView({ behavior: "instant", block: "start" });
  }

  const regions = [false, true].map(exclusive => {
    const nodes = treeNodes.filter(n => isLegacyExclusiveNode(tree.season, n.column) === exclusive);
    const position = (n: LegacyTalentNode) => {
      const p = legacyNodePosition(tree.season, n);
      return { x: exclusive ? (p.x - 360) / 5.4 : p.x / 3.4, y: p.y / 8 };
    };
    const paths = nodes.flatMap(source => source.afterIds.flatMap(id => {
      const target = nodes.find(n => n.id === id);
      if (!target) return [];
      const a = position(source), b = position(target);
      return [{ id: `${source.id}-${id}`, active: false, d: `M ${a.x} ${a.y + 4} V ${(a.y + b.y) / 2} H ${b.x} V ${b.y - 4}` }];
    }));
    return { exclusive, nodes, position, paths };
  });

  return <section className={styles.builder} style={{ "--talent-accent": presentation.color, "--talent-accent-soft": `${presentation.color}26`, "--talent-glow": `${presentation.color}55` } as CSSProperties}>
    <div className={styles.builderScene}><LegacyTalentScene season={tree.season} /></div>
    <TalentHeader season={tree.season} links={branchLinks} activeId={tree.id} activeSkillId={tree.nodes.find(n => n.isRoot)?.id} name={tree.name} icon={legacyAsset(presentation.icon)} weapons={tree.subtitle} onInspect={() => update(restoreLegacyTalentView(tree.nodes, null), true)} />
    <TalentWorkspace details={
      <TalentDetails season={tree.season} name={node.name} icon={node.icon} panelRef={detailRef} id="talent-detail" onReset={() => update(restoreLegacyTalentView(tree.nodes, null))} resetLabel="重置浏览状态"
        imageContent={node.isRoot ? undefined : <LegacyGlyph node={node} availableIcons={availableIcons} large />}
        headingActions={<button className={styles.mobileReturn} title="返回天赋树" aria-label="返回天赋树" onClick={() => treeRef.current?.scrollIntoView({ block: "start", behavior: "instant" })}><ArrowDown size={18} /></button>}
        actions={<p className={styles.ruleNotice}>前置解锁与退点规则未核实，暂不开放模拟加点。</p>}>
        {!node.isRoot && <label className={styles.levelControl}>效果等级<select aria-label="效果等级" value={level.level} onChange={e => update({ ...view, level: Number(e.target.value) })}>{node.levels.map(l => <option key={l.level} value={l.level}>等级 {l.level} / {node.maxLevel}</option>)}</select></label>}
        <p className={styles.description}>{level.description}</p>
        {level.warnings.length > 0 && <p className={styles.warning}>部分效果缺少完整数值证据；待核实数值未作为配置值展示。当前主表数据不等同于历史实测。</p>}
        {!availableIcons.includes(node.icon) && <p className={styles.warning}>节点图标尚未完成定位，暂以问号标记。</p>}
        {displayFacts.length > 0 && <section className={styles.facts}><h3>当前同 ID 配置 · 非历史效果确认</h3><dl>{displayFacts.map((fact, i) => <div key={i}><dt>{fact.label}</dt><dd>{fact.displayValue}</dd></div>)}</dl></section>}
        <details className={styles.evidence}><summary>来源与核验记录</summary>
          <p>节点 ID：{node.id} · 技能 ID：{node.skillIds.join("、") || "未定位"}</p>
          {level.modifierRows.map(row => <p key={row}>{row}</p>)}
          {level.facts.map((fact, i) => <p key={`source-${i}`}>{fact.label}：{fact.value}<br />{fact.source}</p>)}
          {level.warnings.map((warning, i) => <p key={`warning-${i}`}>{warning}</p>)}
          {tree.evidenceNotes.map(note => <p key={note}>{note}</p>)}
        </details>
      </TalentDetails>
    }>
      <div className={styles.treeSection}>
        <div ref={treeRef} className={styles.tree} aria-label={`${tree.name}天赋节点`}>
          {regions.map(region => <section key={String(region.exclusive)} className={styles.treeRegion} data-exclusive={region.exclusive} aria-label={region.exclusive ? "专属天赋" : "被动天赋"}>
            <h2>{region.exclusive ? "专属天赋" : "被动天赋"}</h2>
            <TalentConnectorLines paths={region.paths} />
            {region.nodes.map(n => {
              const position = region.position(n);
              return <TalentNode key={n.id} node={n} preview selected={node.id === n.id} level={0} unlocked onSelect={() => update({ version: 1, nodeId: n.id, level: 1 }, true)} className={styles.positionedNode}
                style={{ left: `${position.x}%`, top: `${position.y}%`, color: region.exclusive ? presentation.color : "#b3b8bb" }} iconContent={<LegacyGlyph node={n} availableIcons={availableIcons} />} />;
            })}
          </section>)}
        </div>
        <div className={styles.treeFoot}><Info size={14} aria-hidden="true" /><span>{tree.nodeCount} 个节点 · {tree.historicalStatus === "unconfirmed" ? "入口锁定的历史配置，录像未收录" : "当前配置参考，历史解锁条件待核实"}</span></div>
      </div>
    </TalentWorkspace>
  </section>;
}
