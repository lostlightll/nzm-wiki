"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { rememberCatalogNavigation } from "@/lib/catalog-navigation";

type CatalogLinkProps = Omit<ComponentProps<typeof Link>, "href"> & {
  href: string;
};

export function CatalogLink({
  href,
  onClick,
  ...props
}: CatalogLinkProps) {
  return (
    <Link
      {...props}
      href={href}
      onClick={(event) => {
        onClick?.(event);
        if (
          !event.defaultPrevented &&
          event.button === 0 &&
          !event.metaKey &&
          !event.ctrlKey &&
          !event.shiftKey &&
          !event.altKey
        ) {
          rememberCatalogNavigation(href);
        }
      }}
    />
  );
}
