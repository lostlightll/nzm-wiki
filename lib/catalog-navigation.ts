const CATALOG_RETURN_TARGET_KEY = "navigation:catalog:return-target";
const CATALOG_RETURN_MAX_AGE_MS = 30 * 60 * 1000;

interface CatalogNavigationState {
  sourceUrl: string;
  targetPath: string;
  scrollY: number;
  createdAt: number;
}

function readCatalogNavigation(): CatalogNavigationState | null {
  const value = sessionStorage.getItem(CATALOG_RETURN_TARGET_KEY);
  if (!value) return null;

  try {
    return JSON.parse(value) as CatalogNavigationState;
  } catch {
    sessionStorage.removeItem(CATALOG_RETURN_TARGET_KEY);
    return null;
  }
}

export function rememberCatalogNavigation(href: string) {
  const targetPath = new URL(href, window.location.href).pathname;
  const state: CatalogNavigationState = {
    sourceUrl: `${window.location.pathname}${window.location.search}${window.location.hash}`,
    targetPath,
    scrollY: window.scrollY,
    createdAt: Date.now(),
  };
  sessionStorage.setItem(CATALOG_RETURN_TARGET_KEY, JSON.stringify(state));
}

export function canReturnToCatalog(targetPath: string) {
  const state = readCatalogNavigation();
  return (
    state?.targetPath === targetPath &&
    Date.now() - state.createdAt <= CATALOG_RETURN_MAX_AGE_MS
  );
}

export function restoreCatalogNavigation() {
  const state = readCatalogNavigation();
  sessionStorage.removeItem(CATALOG_RETURN_TARGET_KEY);

  if (!state || Date.now() - state.createdAt > CATALOG_RETURN_MAX_AGE_MS) {
    return;
  }

  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (currentUrl !== state.sourceUrl) return;

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: state.scrollY, behavior: "auto" });
    });
  });
}
