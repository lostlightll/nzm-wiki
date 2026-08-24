import type { ReactNode } from "react";

export function renderInlineDescription(description: string): ReactNode {
  const parts = description.split(
    /(\*\*[^*\n]+?\*\*|<strong>[\s\S]*?<\/strong>)/gi,
  );

  return parts.map((part, index) => {
    const htmlStrong = part.match(/^<strong>([\s\S]*)<\/strong>$/i);
    if (htmlStrong) return <strong key={index}>{htmlStrong[1]}</strong>;
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

export function stripInlineDescriptionMarkup(description: string): string {
  return description.replace(/<[^>]+>|\*\*/g, "").trim();
}
