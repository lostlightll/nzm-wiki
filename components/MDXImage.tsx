"use client";

import { getAssetPath } from "@/lib/path";

type MDXImageProps = React.ImgHTMLAttributes<HTMLImageElement>;

export function MDXImage({ src, alt, ...props }: MDXImageProps) {
  if (!src) return null;

  // Only process local paths (starting with /)
  const imageSrc = src.startsWith("/") ? getAssetPath(src) : src;

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={imageSrc} alt={alt || ""} {...props} />;
}
