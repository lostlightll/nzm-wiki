"use client";

import Image from "next/image";
import { Check, X } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useId, useRef, type CSSProperties, type ReactNode } from "react";
import { getAssetPath } from "@/lib/path";
import styles from "./talent-passive-selector.module.css";

export interface PassiveOption { id: string; name: string; icon: string }

export function TalentPassiveSelector({ season, title = "选择被动天赋", options, previewId, equippedId, onPreview, onApply, onClose, children, tags, requirement, theme, id, disabled = false, onUnequip }: {
  season: string; title?: string; options: readonly PassiveOption[]; previewId: string; equippedId: string | null;
  onPreview: (id: string) => void; onApply: (id: string) => void; onClose: () => void;
  children: ReactNode; tags?: readonly string[]; requirement?: ReactNode; theme?: CSSProperties; id?: string;
  disabled?: boolean; onUnequip?: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const selected = options.find(option => option.id === previewId) ?? options[0];
  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      element?.close();
      document.body.style.overflow = overflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  if (typeof document === "undefined") return null;
  const equipped = selected?.id === equippedId;
  return createPortal(<dialog ref={dialog} id={id} className={styles.dialog} style={theme} aria-labelledby={headingId}
    onCancel={event => { event.preventDefault(); onClose(); }}
    onKeyDown={event => {
      if (event.key !== "Tab") return;
      const targets = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex="0"]')).filter(element => element.getClientRects().length);
      const first = targets[0], last = targets.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}
    onClick={event => {
      if (event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
    }}>
    <header><div><small>{season.toUpperCase()} 被动天赋</small><h2 id={headingId}>{title}</h2></div>
      <button type="button" className={styles.close} aria-label="关闭被动天赋弹窗" onClick={onClose}><X size={20} /></button>
    </header>
    {selected ? <>
      <div className={styles.body}>
        <div className={styles.gallery}>
          <div className={styles.preview}><Image src={getAssetPath(selected.icon)} alt={selected.name} fill sizes="240px" /></div>
          <div className={styles.options} aria-label={`${season.toUpperCase()} 被动天赋列表`}>
            {options.map(option => <button key={option.id} id={`season-talent-passive-${option.id}`} type="button" aria-label={`预览${option.name}`} aria-pressed={option.id === selected.id} onClick={() => onPreview(option.id)}>
              <span className={styles.optionIcon}><Image src={getAssetPath(option.icon)} alt="" fill sizes="64px" /></span>
              <span className={styles.optionName}>{option.name}</span>
              {option.id === equippedId && <span className={styles.equipped} aria-label="已装备"><Check size={13} /></span>}
            </button>)}
          </div>
        </div>
        <section className={styles.details} aria-label="被动天赋详情" aria-live="polite">
          <h3>{selected.name}</h3>
          {!!tags?.length && <div className={styles.tags}>{tags.map(tag => <span key={tag}>{tag}</span>)}</div>}
          <div className={styles.description}>{children}</div>
        </section>
      </div>
      <footer><div className={styles.requirement}>{requirement}</div><div className={styles.actions}>
        {equipped && onUnequip && <button type="button" className={styles.unequip} disabled={disabled} onClick={onUnequip}>取消装备</button>}
        <button type="button" className={styles.apply} disabled={disabled} aria-label={equipped ? `${selected.name}使用中，关闭弹窗` : `使用${selected.name}`} onClick={() => equipped ? onClose() : onApply(selected.id)}>{equipped ? "使用中" : "使用"}</button>
      </div></footer>
    </> : <p className={styles.empty}>暂无可选被动天赋</p>}
  </dialog>, document.body);
}
