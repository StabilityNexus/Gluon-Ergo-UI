export const resolveAssetPath = (path: string, basePath?: string): string => {
  if (!path || path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (basePath && (normalizedPath === basePath || normalizedPath.startsWith(`${basePath}/`))) {
    return normalizedPath;
  }

  return `${basePath ?? ""}${normalizedPath}`;
};