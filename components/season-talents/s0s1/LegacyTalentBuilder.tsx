"use client";

import { ArrowDown, HelpCircle, Info } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { LegacyTalentNode, LegacyTalentTree } from "@/lib/s0s1-season-talents";
import { legacyDescriptionParts } from "@/lib/s0s1-talent-description";
import { LEGACY_TALENT_CATALOG, legacyAsset, legacyPresentation } from "@/lib/s0s1-talent-presentation";
import { isLegacyExclusiveNode, legacyNodePosition, legacyViewStorageKey, restoreLegacyTalentView, type LegacyTalentView } from "@/lib/s0s1-talent-view";
import { getAssetPath } from "@/lib/path";
import { MultiplierSourceBadges } from "@/components/MultiplierBadges";
import { legacySimulationNodes } from "@/lib/s0s1-season-talent-builder";
import { getS3SpentTalentPoints, isS3TalentNodeUnlocked, restoreS3TalentBuild, setS3TalentNodeLevel } from "@/lib/s3-season-talent-builder";
import { TalentConnectorLines, TalentDetails, TalentHeader, TalentLevelActions, TalentLevelPreview, TalentNode, TalentWorkspace } from "@/components/season-talents/TalentEditor";
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
  const simulationNodes = useMemo(() => legacySimulationNodes(tree), [tree]);
  const [levels, setLevels] = useState<Record<string, number>>({});
  const [ready, setReady] = useState(false);
  const detailRef = useRef<HTMLElement>(null);
  const treeRef = useRef<HTMLDivElement>(null);
  const storageKey = legacyViewStorageKey(tree.season, tree.id);
  const buildKey = `nzm-wiki:season-talents:${tree.season}:${tree.id}:build:v1`;
  const node = tree.nodes.find(n => n.id === view.nodeId) ?? tree.nodes[0];
  const level = node.levels.find(l => l.level === view.level) ?? node.levels[0];
  const current = node.isRoot ? 1 : levels[node.id] ?? 0;
  const simulationNode = simulationNodes.find(n => n.id === node.id);
  const unlocked = !simulationNode || isS3TalentNodeUnlocked(simulationNode, simulationNodes, levels);
  const descriptionParts = legacyDescriptionParts(level);
  const branchLinks = LEGACY_TALENT_CATALOG.filter(t => t.season === tree.season && (t.confirmed || t.id === tree.id)).map(t => ({ id: t.id, name: t.confirmed ? t.name : `${t.name} · 存档` }));
  const treeNodes = tree.nodes.filter(n => !n.isRoot);

  useEffect(() => {
    function sync() {
      let saved: unknown = null;
      try { saved = JSON.parse(window.localStorage.getItem(storageKey) ?? "null"); } catch { /* Storage is optional. */ }
      const requested = new URLSearchParams(window.location.search).get("node");
      const restored = restoreLegacyTalentView(tree.nodes, saved);
      let build: unknown = null;
      try { build = JSON.parse(window.localStorage.getItem(buildKey) ?? "null"); } catch { /* Storage is optional. */ }
      setLevels(restoreS3TalentBuild(simulationNodes, "", build, new Set()).levels);
      setReady(true);
      setView(requested && requested !== restored.nodeId && tree.nodes.some(n => n.id === requested) ? restoreLegacyTalentView(tree.nodes, { version: 1, nodeId: requested, level: 1 }) : restored);
    }
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [storageKey, buildKey, tree.nodes, simulationNodes]);

  useEffect(() => {
    if (!ready) return;
    try { window.localStorage.setItem(buildKey, JSON.stringify({ version: 1, levels, passiveId: null })); } catch { /* Simulation works without persistence. */ }
  }, [buildKey, levels, ready]);

  function change(id: string, requested: number) {
    if (!ready) return;
    const next = setS3TalentNodeLevel(simulationNodes, levels, id, requested);
    setLevels(next);
    update({ version: 1, nodeId: id, level: Math.max(1, next[id] ?? 0) });
  }

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
      return [{ id: `${source.id}-${id}`, active: !!levels[source.id] && !!levels[id], d: `M ${a.x} ${a.y + 4} V ${(a.y + b.y) / 2} H ${b.x} V ${b.y - 4}` }];
    }));
    return { exclusive, nodes, position, paths };
  });

  return <section className={styles.builder} style={{ "--talent-accent": presentation.color, "--talent-accent-soft": `${presentation.color}26`, "--talent-glow": `${presentation.color}55` } as CSSProperties}>
    <div className={styles.builderScene}><LegacyTalentScene season={tree.season} /></div>
    <TalentHeader season={tree.season} links={branchLinks} activeId={tree.id} activeSkillId={tree.nodes.find(n => n.isRoot)?.id} name={tree.name} icon={legacyAsset(presentation.icon)} weapons={tree.applicableWeapons ? `适配武器：${tree.applicableWeapons}` : tree.subtitle} onInspect={() => update(restoreLegacyTalentView(tree.nodes, null), true)} />
    <TalentWorkspace details={
      <TalentDetails season={tree.season} name={node.name} icon={node.icon} level={current} maxLevel={node.isRoot ? undefined : node.maxLevel} panelRef={detailRef} id="talent-detail" onReset={() => { setLevels({}); update(restoreLegacyTalentView(tree.nodes, null)); }}
        imageContent={node.isRoot ? undefined : <LegacyGlyph node={node} availableIcons={availableIcons} large />}
        headingActions={<button className={styles.mobileReturn} title="返回天赋树" aria-label="返回天赋树" onClick={() => treeRef.current?.scrollIntoView({ block: "start", behavior: "instant" })}><ArrowDown size={18} /></button>}
        actions={!node.isRoot && <TalentLevelActions name={node.name} level={current} maxLevel={node.maxLevel} canDecrease={ready && current > 0} canIncrease={ready && unlocked && current < node.maxLevel && getS3SpentTalentPoints(levels) < 40} onChange={value => change(node.id, value)} />}>
        {!node.isRoot && <TalentLevelPreview level={level.level} maxLevel={node.maxLevel} onChange={level => update({ ...view, level })} />}
        <p className={styles.description}>{descriptionParts.map((part, index) => part.reference
          ? <span key={index}>{part.text}</span>
          : <span key={index}>{part.text.split(/([+-]?\d+(?:\.\d+)?%?)/g).map((text, i) => /^[-+]?\d/.test(text) ? <strong className={styles.value} key={i}>{text}</strong> : text)}</span>)}</p>
        <div id={`multiplier-provider-node-${node.id}`} className="mt-3" data-multiplier-provider-target={`node-${node.id}`}>
          <MultiplierSourceBadges source={{ type: "season-talent", season: tree.season, tree: tree.id, nodeId: node.id }} />
        </div>
      </TalentDetails>
    }>
      <div className={styles.treeSection}>
        <div ref={treeRef} className={styles.tree} aria-label={`${tree.name}天赋节点`}>
          {regions.map(region => <section key={String(region.exclusive)} className={styles.treeRegion} data-exclusive={region.exclusive} aria-label={region.exclusive ? "专属天赋" : "被动天赋"}>
            <h2>{region.exclusive ? "专属天赋" : "被动天赋"}</h2>
            <TalentConnectorLines paths={region.paths} />
            {region.nodes.map(n => {
              const position = region.position(n);
              const stateNode = simulationNodes.find(candidate => candidate.id === n.id)!;
              return <TalentNode key={n.id} node={n} selected={node.id === n.id} level={levels[n.id] ?? 0} unlocked={isS3TalentNodeUnlocked(stateNode, simulationNodes, levels)}
                mutuallyExcluded={!region.exclusive && !levels[n.id] && region.nodes.some(peer => peer.phase === n.phase && !!levels[peer.id])}
                onSelect={() => update({ version: 1, nodeId: n.id, level: Math.max(1, levels[n.id] ?? 0) }, true)} onIncrease={() => change(n.id, (levels[n.id] ?? 0) + 1)} className={styles.positionedNode}
                style={{ left: `${position.x}%`, top: `${position.y}%`, color: region.exclusive ? presentation.color : "#b3b8bb" }} iconContent={<LegacyGlyph node={n} availableIcons={availableIcons} />} />;
            })}
          </section>)}
        </div>
        <div className={styles.treeFoot}><Info size={14} aria-hidden="true" /><span>{getS3SpentTalentPoints(levels)}/40 点 · 双击节点加点</span></div>
      </div>
    </TalentWorkspace>
  </section>;
}
