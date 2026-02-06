"use client";

import { getAssetPath } from "@/lib/path";

type MDXLinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement>;

export function MDXLink({ href, children, ...props }: MDXLinkProps) {
  if (!href) return <a {...props}>{children}</a>;

  // 处理所有本地链接
  const linkHref =
    typeof href === "string" && href.startsWith("/")
      ? getAssetPath(href)
      : href;

  return (
    <a href={linkHref} {...props}>
      {children}
    </a>
  );
}
