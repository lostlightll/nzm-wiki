"use client";

import { useEffect, useState } from "react";

interface TocItem {
  id: string;
  text: string;
  level: number;
}

interface TableOfContentsProps {
  enabled?: boolean;
}

export function TableOfContents({ enabled = true }: TableOfContentsProps) {
  const [headings, setHeadings] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    const article = document.querySelector("article");
    if (!article) return;

    const elements = article.querySelectorAll("h2, h3");
    const items: TocItem[] = [];

    elements.forEach((el, index) => {
      // 使用索引生成唯一 id，避免中文编码问题
      const id = el.id || `heading-${index}`;
      if (!el.id) el.id = id;

      items.push({
        id,
        text: el.textContent || "",
        level: el.tagName === "H2" ? 2 : 3,
      });
    });

    const frame = window.requestAnimationFrame(() => setHeadings(items));

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: "-80px 0px -80% 0px" }
    );

    elements.forEach((el) => observer.observe(el));

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [enabled]);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const element = document.getElementById(id);
    if (element) {
      const offset = 80; // 导航栏高度 + 一点间距
      const top = element.getBoundingClientRect().top + window.scrollY - offset;
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top, behavior: reduceMotion ? "auto" : "smooth" });
      setIsOpen(false);
    }
  };

  if (!enabled || headings.length === 0) return null;

  return (
    <nav className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 z-40 xl:bottom-auto xl:left-8 xl:top-[38.2%]" aria-label="本页目录">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls="page-table-of-contents"
        onClick={() => setIsOpen((open) => !open)}
        className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-zinc-600 bg-zinc-800/95 px-3 text-sm font-medium text-zinc-200 shadow-lg backdrop-blur hover:bg-zinc-700 xl:px-2"
      >
        <span className="xl:hidden">目录</span>
        <span className="hidden flex-col gap-1.5 xl:flex" aria-hidden="true">
          {headings.slice(0, 5).map((heading) => (
            <span key={heading.id} className={`h-0.5 rounded-full ${heading.level === 3 ? "ml-1 w-3" : "w-4"} ${activeId === heading.id ? "bg-blue-400" : "bg-zinc-400"}`} />
          ))}
        </span>
      </button>

      <div
        id="page-table-of-contents"
        hidden={!isOpen}
        className="absolute bottom-full left-0 mb-2 max-h-[60dvh] min-w-52 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-800/95 px-1 py-2 shadow-xl backdrop-blur xl:bottom-auto xl:left-full xl:top-0 xl:mb-0 xl:ml-2"
      >
        <ul className="text-sm">
          {headings.map((heading) => (
            <li key={heading.id}>
              <a
                href={`#${heading.id}`}
                onClick={(e) => handleClick(e, heading.id)}
                aria-current={activeId === heading.id ? "location" : undefined}
                className={`block min-h-11 rounded px-3 py-3 transition-colors hover:bg-zinc-700/50 xl:min-h-0 xl:py-2 ${
                  heading.level === 3 ? "pl-4 text-xs" : ""
                } ${
                  activeId === heading.id
                    ? "text-blue-400 bg-blue-500/10"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                {heading.text}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
