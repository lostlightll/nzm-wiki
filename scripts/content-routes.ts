export interface ContentRouteRule {
  category: string;
  contentPrefix: string;
  routePrefix?: string;
  searchable: boolean;
}

export const CONTENT_ROUTE_RULES: readonly ContentRouteRule[] = [
  {
    contentPrefix: "enemies/lc/elite",
    category: "猎场精英",
    searchable: false,
  },
  {
    contentPrefix: "enemies/lc/boss",
    routePrefix: "/enemies/lc",
    category: "首领",
    searchable: true,
  },
  {
    contentPrefix: "enemies/td",
    routePrefix: "/enemies/td",
    category: "塔防敌人",
    searchable: true,
  },
  {
    contentPrefix: "weapons_td",
    routePrefix: "/weapons/td",
    category: "塔防武器",
    searchable: false,
  },
  {
    contentPrefix: "weapons",
    routePrefix: "/weapons",
    category: "武器",
    searchable: true,
  },
  {
    contentPrefix: "perks",
    routePrefix: "/perks",
    category: "特性",
    searchable: true,
  },
  {
    contentPrefix: "traps",
    routePrefix: "/traps",
    category: "陷阱",
    searchable: true,
  },
  {
    contentPrefix: "cards",
    routePrefix: "/cards",
    category: "卡牌",
    searchable: true,
  },
  {
    contentPrefix: "posts",
    routePrefix: "/posts",
    category: "文章",
    searchable: true,
  },
] as const;

export const STATIC_PAGE_ROUTES = [
  "/",
  "/weapons",
  "/perks",
  "/traps",
  "/enemies",
  "/enemies/lc",
  "/enemies/td",
  "/posts",
  "/damage",
  "/credits",
] as const;

function matchesContentPrefix(slug: string, prefix: string): boolean {
  return slug === prefix || slug.startsWith(`${prefix}/`);
}

export function getContentRouteRule(slug: string): ContentRouteRule | undefined {
  return CONTENT_ROUTE_RULES.find((rule) =>
    matchesContentPrefix(slug, rule.contentPrefix),
  );
}

export function resolveContentPath(slug: string): string | undefined {
  const rule = getContentRouteRule(slug);
  if (!rule?.routePrefix) return undefined;

  return `${rule.routePrefix}${slug.slice(rule.contentPrefix.length)}`;
}
