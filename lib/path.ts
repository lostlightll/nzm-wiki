export const getAssetPath = (path: string) => {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  // 将 .png 转换为 public/webp/ 路径下的 .webp
  // 例如 /images/foo/bar.png -> /webp/images/foo/bar.webp
  if (normalizedPath.endsWith(".png")) {
    const webpPath = `/webp${normalizedPath.replace(/\.png$/, ".webp")}`;
    return `${basePath}${webpPath}`;
  }

  return `${basePath}${normalizedPath}`;
};
