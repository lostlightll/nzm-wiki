"use client";

import { getImageAssetPaths } from "@/lib/path";

type MDXImageProps = React.ImgHTMLAttributes<HTMLImageElement>;

export function MDXImage({
  src,
  alt,
  width = 1024,
  height = 1024,
  loading = "lazy",
  decoding = "async",
  onError,
  style,
  ...props
}: MDXImageProps) {
  if (!src || typeof src !== "string") return null;

  const imagePaths = src.startsWith("/")
    ? getImageAssetPaths(src)
    : { src, fallbackSrc: undefined };

  const handleError: React.ReactEventHandler<HTMLImageElement> = (event) => {
    if (
      imagePaths.fallbackSrc &&
      event.currentTarget.dataset.fallbackApplied !== "true"
    ) {
      event.currentTarget.dataset.fallbackApplied = "true";
      event.currentTarget.src = imagePaths.fallbackSrc;
    }
    onError?.(event);
  };

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imagePaths.src}
      alt={alt || ""}
      width={width}
      height={height}
      loading={loading}
      decoding={decoding}
      onError={handleError}
      style={{ height: "auto", ...style }}
      {...props}
    />
  );
}
