import type { CSSProperties, ReactNode } from "react";
import { TableOfContents } from "@/components/TableOfContents";

const PAGE_WIDTH_CLASSES: Record<string, string> = {
  sm: "max-w-xl",
  md: "max-w-2xl",
  lg: "max-w-3xl",
  xl: "max-w-4xl",
  "2xl": "max-w-5xl",
  "3xl": "max-w-6xl",
  full: "max-w-7xl",
};

function resolvePageWidth(pageWidth: unknown): {
  className: string;
  style?: CSSProperties;
} {
  if (typeof pageWidth !== "string") {
    return { className: "max-w-3xl" };
  }

  const preset = PAGE_WIDTH_CLASSES[pageWidth];
  if (preset) return { className: preset };

  if (/^\d+(?:\.\d+)?(?:px|rem|em|vw|%)$/.test(pageWidth)) {
    return {
      className: "max-w-[var(--page-width)] max-md:max-w-full",
      style: { "--page-width": pageWidth } as CSSProperties,
    };
  }

  return { className: "max-w-3xl" };
}

interface MDXDetailLayoutProps {
  children: ReactNode;
  pageWidth?: unknown;
  toc?: boolean;
  className?: string;
}

export function MDXDetailLayout({
  children,
  pageWidth,
  toc = true,
  className = "",
}: MDXDetailLayoutProps) {
  const width = resolvePageWidth(pageWidth);

  return (
    <>
      <TableOfContents enabled={toc} />
      <div
        className={`mx-auto py-6 ${width.className} ${className}`.trim()}
        style={width.style}
      >
        {children}
      </div>
    </>
  );
}
