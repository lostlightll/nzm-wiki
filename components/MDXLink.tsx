"use client";

import React from "react";
import { getAssetPath } from "@/lib/path";

type MDXLinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement>;

export function MDXLink({ href, children, ...props }: MDXLinkProps) {
  if (!href) return <a {...props}>{children}</a>;

  // 防止 <a> 嵌套：如果 children 已经是 <a> 元素，直接返回
  if (React.isValidElement(children) && children.type === "a") {
    return children;
  }

  // 处理所有本地链接
  const linkHref =
    typeof href === "string" && href.startsWith("/")
      ? getAssetPath(href)
      : href;

  // 外部链接自动在新标签页打开
  const isExternal =
    typeof linkHref === "string" &&
    (linkHref.startsWith("http://") || linkHref.startsWith("https://"));
  const externalProps = isExternal
    ? { target: "_blank" as const, rel: "noopener noreferrer" }
    : {};

  return (
    <a href={linkHref} {...externalProps} {...props}>
      {children}
    </a>
  );
}
