"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowLeftRight, Check, Copy, Minus, Plus, RotateCcw, X } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import catalog from "@/data/season-talents/s2/catalog.json";
import { getAssetPath } from "@/lib/path";
import { emptyS2Build, restoreS2Build, s2PrerequisiteGroups, s2SpentPoints, s2UnlockReason, setS2Level, type S2TalentNode, type S2TalentTree } from "@/lib/s2-season-talent-builder";
import styles from "./s2.module.css";

function position(node: S2TalentNode) {
  return { x: node.column >= 5 ? 205 + (node.column - 6) * 108 : 485 + (node.column - 1) * 108, y: 72 + (node.phase - 2) * 116 };
}

function Description({ text }: { text: string }) {
  return <div className={styles.description}>{text.split("\n").map((line, i) => <p key={i}>{line.split(/([+-]?\d+(?:\.\d+)?%?)/g).map((part, j) => j % 2 ? <strong key={j}>{part}</strong> : part)}</p>)}</div>;
}

export function S2SeasonTalentBuilder({ tree }: { tree: S2TalentTree }) {
  const root = tree.nodes.find(n => n.isRoot)!;
  const [build, setBuild] = useState(emptyS2Build);
  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState(root.id);
  const [previewLevel, setPreviewLevel] = useState(1);
  const [mobileTab, setMobileTab] = useState<"special" | "common">("special");
  const [detailOpen, setDetailOpen] = useState(false);
  const [modal, setModal] = useState<"passives" | "reset" | null>(null);
  const [notice, setNotice] = useState("");
  const [scale, setScale] = useState(1);
  const dialog = useRef<HTMLDialogElement>(null);
  const detailDialog = useRef<HTMLDialogElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const key = `nzm-wiki:s2-talents:${tree.id}:v1`;
  const node = tree.nodes.find(n => n.id === selected);
  const passive = tree.passives.find(p => p.id === selected);
  const activePassive = tree.passives.find(p => p.id === build.passiveId);
  const points = s2SpentPoints(tree, build.levels);
  const current = node?.isRoot ? 1 : build.levels[selected] ?? 0;
  const reason = node ? s2UnlockReason(tree, node, build.levels) : null;
  const level = Math.min(previewLevel, node?.maxLevel ?? 1);

  useEffect(() => {
    const sync = () => {
      const params = new URLSearchParams(window.location.search);
      let value: unknown = null;
      try { value = JSON.parse(params.get("build") ?? localStorage.getItem(key) ?? "null"); } catch { /* Invalid saves cannot modify other seasons. */ }
      setBuild(restoreS2Build(tree, value));
      setReady(true);
      const id = params.get("node") ?? params.get("passive");
      const target = tree.nodes.find(n => n.id === id);
      if (id && (target || tree.passives.some(p => p.id === id))) {
        setSelected(id);
        setMobileTab(target && target.column < 5 ? "common" : "special");
        setPreviewLevel(1);
        setDetailOpen(true);
      }
    };
    const frame = requestAnimationFrame(sync);
    window.addEventListener("popstate", sync);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("popstate", sync); };
  }, [key, tree]);

  useEffect(() => {
    if (!ready) return;
    const url = new URL(window.location.href);
    if (url.searchParams.has("build")) {
      url.searchParams.set("build", JSON.stringify(build));
      window.history.replaceState(window.history.state, "", url);
    }
    try { localStorage.setItem(key, JSON.stringify(build)); }
    catch { const frame = requestAnimationFrame(() => setNotice("浏览器存储不可用，配点仅在本次访问保留。")); return () => cancelAnimationFrame(frame); }
  }, [build, key, ready]);

  useEffect(() => {
    if (modal) dialog.current?.showModal(); else dialog.current?.close();
  }, [modal]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 900px)");
    const sync = () => {
      if (detailOpen && media.matches) detailDialog.current?.showModal();
      else detailDialog.current?.close();
    };
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, [detailOpen]);

  useEffect(() => {
    const container = viewport.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => {
      const mobile = window.matchMedia("(max-width: 900px)").matches;
      setScale(mobile ? Math.min(1, entry.contentRect.width / 380) : Math.max(.55, Math.min(1.15, entry.contentRect.width / 800, entry.contentRect.height / 650)));
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const inspect = (id: string) => {
    setSelected(id); setPreviewLevel(Math.max(1, build.levels[id] ?? 0)); setDetailOpen(true);
    const url = new URL(window.location.href);
    url.searchParams.delete("node"); url.searchParams.delete("passive");
    url.searchParams.set(tree.passives.some(p => p.id === id) ? "passive" : "node", id);
    window.history.replaceState(window.history.state, "", url);
  };
  const change = (value: number) => {
    setBuild(previous => setS2Level(tree, previous, selected, value));
    setPreviewLevel(Math.max(1, value));
  };
  const share = async () => {
    const url = new URL(window.location.href);
    url.searchParams.set("build", JSON.stringify(build));
    try { await navigator.clipboard.writeText(url.toString()); setNotice("配点链接已复制"); }
    catch { setNotice("无法访问剪贴板，未复制配点链接。"); }
  };
  const details = <>
    <div className={styles.detailHeading}>
      <Image src={getAssetPath(node?.icon ?? passive?.icon ?? tree.icon)} alt="" width={56} height={56} />
      <div><span className={styles.eyebrow}>{passive ? "被动天赋" : node?.isRoot ? "主动技能" : node && node.column >= 5 ? "专属天赋" : "通用天赋"}</span><h2>{node?.name ?? passive?.name}</h2></div>
    </div>
    {node && !node.isRoot && <div className={styles.levelPreview} aria-label="等级预览">{Array.from({ length: node.maxLevel }, (_, i) => <button type="button" key={i} aria-label={`预览 ${i + 1} 级`} aria-pressed={level === i + 1} onClick={() => setPreviewLevel(i + 1)}>{i + 1} 级</button>)}</div>}
    <Description text={node?.descriptions[level - 1] ?? passive?.description ?? ""} />
    {node?.isRoot && <div className={styles.weaponTypes}><span>适配武器</span><p>{tree.applicableWeapons}</p></div>}
    {node && !node.isRoot && <div className={styles.allocationArea}>
      <p className={styles.requirement}>{reason ?? (current === node.maxLevel ? "已满级" : `升级消耗 ${node.costs[current]} 点`)}</p>
      <div className={styles.allocation}>
        <button type="button" title="减点" aria-label={`降低${node.name}等级`} disabled={!ready || current === 0} onClick={() => change(current - 1)}><Minus size={20} /></button>
        <output aria-label="当前等级">{current}<span> / {node.maxLevel}</span></output>
        <button type="button" title="加点" aria-label={`提升${node.name}等级`} disabled={!ready || !!reason || current >= node.maxLevel || setS2Level(tree, build, node.id, current + 1) === build} onClick={() => change(current + 1)}><Plus size={20} /></button>
      </div>
    </div>}
    {passive && <button type="button" className={styles.equip} disabled={!ready} onClick={() => setBuild(b => ({ ...b, passiveId: b.passiveId === passive.id ? null : passive.id }))}><Check size={18} />{build.passiveId === passive.id ? "取消选择" : "装备被动"}</button>}
    {node?.auditNote && <details className={styles.audit}><summary>资料核验</summary><p>{node.auditNote}</p></details>}
  </>;

  return <section className={styles.builder} aria-label={`${tree.name}天赋树`}>
    <Image src={getAssetPath(catalog.background)} alt="" fill priority sizes="100vw" className={styles.background} />
    <header className={styles.toolbar}>
      <Link href="/season-talents#s2" aria-label="返回 S2 天赋" title="返回 S2 天赋"><ArrowLeft size={21} /></Link>
      <div className={styles.toolbarTitle}><span className={styles.eyebrow}>S2 · 樱之渊</span><h1>{tree.name}</h1></div>
      <div className={styles.budget} aria-live="polite"><span>配点预算</span><div><strong>{points}</strong> / {tree.pointLimit}</div></div>
      <button type="button" title="复制配点链接" aria-label="复制配点链接" disabled={!ready} onClick={share}><Copy size={19} /></button>
      <button type="button" title="重置配点" aria-label="重置配点" disabled={!ready || (!points && !build.passiveId)} onClick={() => setModal("reset")}><RotateCcw size={20} /></button>
    </header>
    <div className={styles.workspace}>
      <div className={styles.treeArea}>
        <div className={styles.treeHeading}>
          <button type="button" className={styles.root} aria-label={`${tree.name}主动技能`} onClick={() => inspect(root.id)}>
            <Image src={getAssetPath(tree.icon)} alt="" width={78} height={78} /><span>{tree.name}</span>
          </button>
          <button type="button" className={styles.passiveSelector} onClick={() => setModal("passives")}>
            {activePassive ? <Image src={getAssetPath(activePassive.icon)} alt="" width={42} height={42} /> : <Plus size={26} />}
            <span><small>被动天赋</small><strong>{activePassive?.name ?? "选择被动天赋"}</strong></span><ArrowLeftRight size={18} />
          </button>
        </div>
        <div className={styles.mobileTabs} role="group" aria-label="天赋类别">
          <button type="button" aria-pressed={mobileTab === "special"} onClick={() => setMobileTab("special")}>专属天赋</button>
          <button type="button" aria-pressed={mobileTab === "common"} onClick={() => setMobileTab("common")}>通用天赋</button>
        </div>
        <div className={styles.treeViewport} ref={viewport}>
          <div className={styles.board} data-mobile-tab={mobileTab} style={{ "--board-scale": scale } as CSSProperties}>
            <span className={styles.specialLabel}>专属天赋</span><span className={styles.commonLabel}>通用天赋</span>
            <svg className={styles.connections} viewBox="0 0 800 650" aria-hidden="true">
              {tree.nodes.filter(n => !n.isRoot && n.column >= 5).flatMap(n => s2PrerequisiteGroups(n.prerequisite).flat().map(id => {
                const before = tree.nodes.find(p => p.id === id);
                if (!before || before.isRoot) return null;
                const a = position(before), b = position(n);
                return <path className={styles.specialEdge} key={`${n.id}-${id}`} d={`M ${a.x} ${a.y + 33} L ${b.x} ${b.y - 30}`} data-active={(build.levels[n.id] ?? 0) > 0} />;
              }))}
              {[3, 4, 5, 6].map(phase => {
                const y = 72 + (phase - 3) * 116;
                const parents = tree.nodes.filter(n => n.phase === phase - 1 && n.column < 5);
                const children = tree.nodes.filter(n => n.phase === phase && n.column < 5);
                return <g key={phase} className={styles.commonEdge}>
                  <path d={`M 485 ${y + 61} H 701`} />
                  {parents.map(n => <path key={`p${n.id}`} d={`M ${position(n).x} ${y + 29} V ${y + 61}`} data-active={(build.levels[n.id] ?? 0) === n.maxLevel} />)}
                  {children.map(n => <path key={n.id} d={`M ${position(n).x} ${y + 61} V ${y + 89}`} data-active={(build.levels[n.id] ?? 0) > 0} />)}
                </g>;
              })}
            </svg>
            {tree.nodes.filter(n => !n.isRoot).map(n => {
              const p = position(n), allocated = build.levels[n.id] ?? 0;
              const locked = !!s2UnlockReason(tree, n, build.levels);
              return <button type="button" id={`season-talent-node-${n.id}`} key={n.id}
                className={`${styles.node} ${n.column >= 5 ? styles.special : styles.common}`}
                data-selected={selected === n.id} data-allocated={allocated > 0} data-locked={locked}
                style={{ left: p.x, top: p.y }} aria-label={`${n.name}，${allocated}/${n.maxLevel}${locked ? "，未解锁" : ""}`} aria-pressed={selected === n.id} title={n.name} onClick={() => inspect(n.id)}>
                <span className={styles.nodeFrame}><Image src={getAssetPath(n.icon)} alt="" width={46} height={46} /></span>
                <span className={styles.pips}>{Array.from({ length: n.maxLevel }, (_, i) => <i key={i} data-filled={i < allocated} />)}</span>
                <span className={styles.nodeName}>{n.name}</span>
              </button>;
            })}
          </div>
        </div>
      </div>
      <aside className={styles.details} aria-label="天赋详情">{details}</aside>
    </div>
    <p className={styles.notice} role="status">{notice}</p>
    <dialog ref={detailDialog} className={styles.mobileDetails} onCancel={() => setDetailOpen(false)} onClose={() => setDetailOpen(false)}>
      <button type="button" className={styles.closeButton} aria-label="关闭天赋详情" onClick={() => setDetailOpen(false)}><X size={21} /></button>{details}
    </dialog>
    <dialog ref={dialog} className={styles.modal} onCancel={() => setModal(null)} onClose={() => setModal(null)}>
      <header><h2>{modal === "reset" ? "重置配点" : "选择被动天赋"}</h2><button type="button" aria-label="关闭" onClick={() => setModal(null)}><X size={22} /></button></header>
      {modal === "reset" ? <div className={styles.resetBody}><p>清空「{tree.name}」的配点与被动选择？</p><button type="button" className={styles.equip} onClick={() => { setBuild(emptyS2Build()); setPreviewLevel(1); setModal(null); }}><RotateCcw size={18} />重置</button></div> :
        <div className={styles.passiveList}>{tree.passives.map(p => <button type="button" key={p.id} aria-pressed={p.id === build.passiveId} onClick={() => { setModal(null); inspect(p.id); }}><Image src={getAssetPath(p.icon)} alt="" width={48} height={48} /><span><strong>{p.name}</strong><span>{p.description}</span></span>{p.id === build.passiveId && <Check size={20} />}</button>)}</div>}
    </dialog>
  </section>;
}
