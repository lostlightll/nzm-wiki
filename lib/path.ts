const EXTERNAL_URL_PATTERN = /^(?:[a-z][a-z\d+.-]*:|\/\/)/i;

export const getAssetPath = (path: string) => {
  if (EXTERNAL_URL_PATTERN.test(path)) return path;

  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${basePath}${normalizedPath}`;
};

export const getOptimizedImagePath = (path: string) => {
  if (EXTERNAL_URL_PATTERN.test(path)) return path;

  const match = path.match(/^([^?#]*)([?#].*)?$/);
  const pathname = match?.[1] ?? path;
  const suffix = match?.[2] ?? "";

  if (!pathname.toLowerCase().endsWith(".png")) {
    return getAssetPath(path);
  }

  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const webpPath = `/webp${normalizedPath.replace(/\.png$/i, ".webp")}${suffix}`;
  return getAssetPath(webpPath);
};

export const getImageAssetPaths = (path: string) => {
  const originalSrc = getAssetPath(path);
  const optimizedSrc = getOptimizedImagePath(path);

  return {
    src: optimizedSrc,
    fallbackSrc: optimizedSrc === originalSrc ? undefined : originalSrc,
  };
};
