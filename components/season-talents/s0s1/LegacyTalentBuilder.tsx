"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowUp, HelpCircle, Info, Minus, Plus, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { LegacyTalentNode, LegacyTalentTree } from "@/lib/s0s1-season-talents";
import { LEGACY_TALENT_CATALOG, legacyAsset, legacyPresentation, legacyTalentHref } from "@/lib/s0s1-talent-presentation";
import { isLegacyExclusiveNode, legacyNodePosition, legacyViewStorageKey, restoreLegacyTalentView, type LegacyTalentView } from "@/lib/s0s1-talent-view";
import { getAssetPath } from "@/lib/path";
import { LegacyTalentScene } from "./LegacyTalentScene";
import styles from "./legacy-talents.module.css";

function TalentIcon({ node, availableIcons }: { node: LegacyTalentNode; availableIcons: string[] }) {
  const [failed, setFailed] = useState(false);
  if (failed || !availableIcons.includes(node.icon)) return <HelpCircle size={26} aria-label="原图缺失" />;
  if (!node.isRoot) return <span aria-hidden="true" className={styles.iconGlyph} style={{maskImage:`url("${getAssetPath(node.icon)}")`}} />;
  return <Image src={getAssetPath(node.icon)} alt="" width={72} height={72} onError={() => setFailed(true)} />;
}

export function LegacyTalentBuilder({tree,availableIcons}:{tree:LegacyTalentTree;availableIcons:string[]}) {
  const presentation = legacyPresentation(tree.season,tree.id)!;
  const [view,setView] = useState<LegacyTalentView>(()=>restoreLegacyTalentView(tree.nodes,null));
  const detailRef = useRef<HTMLElement>(null);
  const treeScrollRef = useRef<HTMLDivElement>(null);
  const storageKey=legacyViewStorageKey(tree.season,tree.id);
  const node=tree.nodes.find(n=>n.id===view.nodeId)??tree.nodes[0];
  const level=node.levels.find(l=>l.level===view.level)??node.levels[0];
  const displayFacts=level.facts.filter(fact=>fact.displayValue);

  useEffect(()=>{
    function reveal() {
      const scroll=treeScrollRef.current;
      const position=legacyNodePosition(node);
      const x=position.x*(scroll?.firstElementChild?.clientWidth??850)/850;
      if(scroll && (x<scroll.scrollLeft+45 || x>scroll.scrollLeft+scroll.clientWidth-45)) scroll.scrollLeft=Math.max(0,x-scroll.clientWidth/2);
      if(scroll && (position.y<scroll.scrollTop+34 || position.y>scroll.scrollTop+scroll.clientHeight-66)) scroll.scrollTop=Math.max(0,position.y-scroll.clientHeight/2);
    }
    reveal();
    window.addEventListener("resize",reveal);
    return ()=>window.removeEventListener("resize",reveal);
  },[node]);

  useEffect(()=>{
    function sync() {
      let saved:unknown=null;
      try { saved=JSON.parse(window.localStorage.getItem(storageKey)??"null"); } catch { /* Storage is optional. */ }
      const requested=new URLSearchParams(window.location.search).get("node");
      const restored=restoreLegacyTalentView(tree.nodes,saved);
      setView(requested && requested!==restored.nodeId && tree.nodes.some(n=>n.id===requested) ? restoreLegacyTalentView(tree.nodes,{version:1,nodeId:requested,level:1}) : restored);
    }
    sync();
    window.addEventListener("popstate",sync);
    return ()=>window.removeEventListener("popstate",sync);
  },[storageKey,tree.nodes]);

  function update(next:LegacyTalentView,focusDetail=false) {
    const normalized=restoreLegacyTalentView(tree.nodes,next);
    setView(normalized);
    try {window.localStorage.setItem(storageKey,JSON.stringify(normalized));} catch { /* The current view remains usable without persistence. */ }
    const url=new URL(window.location.href);
    url.searchParams.set("node",normalized.nodeId);
    url.hash="";
    window.history.replaceState(window.history.state,"",url);
    if(focusDetail && window.matchMedia("(max-width: 1023px)").matches) detailRef.current?.scrollIntoView({behavior:"instant",block:"start"});
  }

  return (
    <section className={styles.builder} style={{"--talent-color":presentation.color} as CSSProperties}>
      <div className={styles.builderScene}><LegacyTalentScene season={tree.season}/></div>
      <nav className={styles.toolbar} aria-label="赛季天赋导航">
        <Link href={`/season-talents#${tree.season}`} className={styles.back}><ArrowLeft size={17} aria-hidden="true"/>{tree.season.toUpperCase()} 赛季天赋</Link>
        <div className={styles.treeHeader}>
          <Image src={getAssetPath(legacyAsset(presentation.icon))} alt="" width={64} height={64}/>
          <div><h1>{tree.name}</h1><p>{tree.subtitle}</p></div>
        </div>
        <div className={styles.branchTabs}>
          {LEGACY_TALENT_CATALOG.filter(t=>t.season===tree.season).map(t=><Link key={t.id} href={legacyTalentHref(t.season,t.id)} aria-current={t.id===tree.id?"page":undefined}>{t.name}{!t.confirmed?" · 存档":""}</Link>)}
        </div>
      </nav>
      <div className={styles.workspace}>
        <div className={styles.treeSection}>
          <div ref={treeScrollRef} className={styles.treeScroll} tabIndex={0} aria-label={`${tree.name}天赋节点`}>
            <div className={styles.tree}>
              <span className={styles.treeHeading} style={{left:tree.season==="s0"?"0%":"8%",width:"24%"}}>通用天赋</span>
              <span className={styles.treeHeading} style={{left:tree.season==="s0"?"49%":"59%",width:"24%"}}>专属天赋</span>
              <svg className={styles.links} viewBox="0 0 850 860" preserveAspectRatio="none" aria-hidden="true">
                {tree.nodes.flatMap(source=>source.afterIds.map(id=>{
                  const target=tree.nodes.find(n=>n.id===id); if(!target)return null;
                  const a=legacyNodePosition(source),b=legacyNodePosition(target);
                  return <path key={`${source.id}-${id}`} d={`M ${a.x} ${a.y+27} V ${(a.y+b.y)/2} H ${b.x} V ${b.y-30}`} fill="none" stroke={isLegacyExclusiveNode(tree.season,source.column)?presentation.color:"#babdbd"} strokeOpacity=".38" strokeWidth="1.4"/>;
                }))}
              </svg>
              {tree.nodes.map(n=>{
                const position=legacyNodePosition(n);
                return <button type="button" id={`season-talent-node-${n.id}`} key={n.id} className={`${styles.node} ${n.isRoot?styles.rootNode:""}`} style={{left:`${position.x/850*100}%`,top:position.y}} data-exclusive={isLegacyExclusiveNode(tree.season,n.column)} data-core={!n.isRoot && (tree.season==="s0"?isLegacyExclusiveNode(tree.season,n.column):n.column===7)} data-selected={node.id===n.id} aria-pressed={node.id===n.id} aria-label={`${n.name}，${n.maxLevel}级`} onClick={()=>update({version:1,nodeId:n.id,level:1},true)}>
                  <span className={styles.nodeShape}><TalentIcon node={n} availableIcons={availableIcons}/>{!n.isRoot && <span className={styles.dots} aria-hidden="true">{Array.from({length:n.maxLevel},(_,i)=><i key={i}/>)}</span>}</span>
                  <span className={styles.nodeName}>{n.name}</span>
                </button>;
              })}
            </div>
          </div>
          <div className={styles.treeFoot}><Info size={14} aria-hidden="true"/><span>{tree.nodeCount} 个节点 · {tree.historicalStatus==="unconfirmed"?"入口锁定的历史配置，录像未收录":"当前配置参考，历史解锁条件待核实"}</span></div>
        </div>
        <aside ref={detailRef} className={styles.details} aria-label="天赋详情" id="talent-detail">
          <header className={styles.detailsHeader}><div className={styles.detailTitle}><h2>{node.name}</h2><button className={styles.mobileReturn} title="返回天赋树" aria-label="返回天赋树" onClick={()=>treeScrollRef.current?.scrollIntoView({block:"start",behavior:"instant"})}><ArrowUp size={17}/></button></div>
            <label className={styles.levelControl}>效果等级<select aria-label="效果等级" value={level.level} onChange={e=>update({...view,level:Number(e.target.value)})}>{node.levels.map(l=><option key={l.level} value={l.level}>等级 {l.level} / {node.maxLevel}</option>)}</select></label>
          </header>
          <div className={styles.detailsBody}>
            <p className={styles.description}>{level.description}</p>
            {level.warnings.length>0 && <p className={styles.warning}>部分效果缺少完整数值证据；待核实数值未作为配置值展示。当前主表数据不等同于历史实测。</p>}
            {!availableIcons.includes(node.icon) && <p className={styles.warning}>原始节点图标缺失，暂以问号标记。</p>}
            {displayFacts.length>0 && <section className={styles.facts}><h3>当前同 ID 配置 · 非历史效果确认</h3><dl>{displayFacts.map((fact,i)=><div key={i}><dt>{fact.label}</dt><dd>{fact.displayValue}</dd></div>)}</dl></section>}
            <details className={styles.evidence}><summary>来源与核验记录</summary>
              <p>节点 ID：{node.id} · 技能 ID：{node.skillIds.join("、")||"未定位"}</p>
              {level.modifierRows.map(row=><p key={row}>{row}</p>)}
              {level.facts.map((fact,i)=><p key={`source-${i}`}>{fact.label}：{fact.value}<br/>{fact.source}</p>)}
              {level.warnings.map((warning,i)=><p key={`warning-${i}`}>{warning}</p>)}
              {tree.evidenceNotes.map(note=><p key={note}>{note}</p>)}
            </details>
          </div>
          <footer className={styles.detailFooter}>
            <p>前置解锁与退点规则未核实，暂不开放模拟加点。</p>
            <div className={styles.allocation}><button disabled title="退点规则待核实" aria-label="减少天赋等级"><Minus size={16}/></button><span>加点待核实</span><button disabled title="加点规则待核实" aria-label="增加天赋等级"><Plus size={16}/></button><button title="返回初始节点" aria-label="重置浏览状态" onClick={()=>update(restoreLegacyTalentView(tree.nodes,null))}><RotateCcw size={15}/></button></div>
          </footer>
        </aside>
      </div>
    </section>
  );
}
