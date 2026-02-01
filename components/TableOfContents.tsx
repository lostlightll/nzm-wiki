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
  const [isHovered, setIsHovered] = useState(false);

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

    setHeadings(items);

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

    return () => observer.disconnect();
  }, [enabled]);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const element = document.getElementById(id);
    if (element) {
      const offset = 80; // 导航栏高度 + 一点间距
      const top = element.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: "smooth" });
    }
  };

  if (!enabled || headings.length === 0) return null;

  return (
    <nav
      className="hidden xl:block fixed left-8 top-[38.2%] z-50"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* 收起状态：小横条 */}
      <div
        className={`flex flex-col gap-2.5 transition-all duration-200 ${
          isHovered ? "opacity-0 scale-95" : "opacity-100 scale-100"
        }`}
      >
        {headings.map((heading, index) => (
          <div
            key={index}
            className={`rounded-full transition-colors ${
              heading.level === 3 ? "ml-2 w-4 h-0.5" : "w-5 h-0.5"
            } ${activeId === heading.id ? "bg-blue-400" : "bg-zinc-600"}`}
          />
        ))}
      </div>

      {/* 展开状态：完整目录 */}
      <div
        className={`absolute left-0 top-0 min-w-36 bg-zinc-800/95 backdrop-blur rounded-lg border border-zinc-700 py-2 px-1 transition-all duration-200 origin-top-left ${
          isHovered
            ? "opacity-100 scale-100"
            : "opacity-0 scale-95 pointer-events-none"
        }`}
      >
        <ul className="text-sm whitespace-nowrap">
          {headings.map((heading) => (
            <li key={heading.id}>
              <a
                href={`#${heading.id}`}
                onClick={(e) => handleClick(e, heading.id)}
                className={`block py-1 px-2 rounded transition-colors hover:bg-zinc-700/50 ${
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
