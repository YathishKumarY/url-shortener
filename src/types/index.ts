export type LinkStatus = "active" | "expired" | "limited" | "scheduled" | "disabled" | "banned";

export interface TagRef {
  id: string;
  name: string;
  color: string;
}

export interface Variant {
  url: string;
  weight: number;
}

/** A link as returned by the API (dates are ISO strings). */
export interface LinkItem {
  id: string;
  domain: string | null;
  shortCode: string;
  shortUrl: string;
  displayUrl: string;
  originalUrl: string;
  customAlias: string | null;
  title: string | null;
  description: string | null;
  hasPassword: boolean;
  expiresAt: string | null;
  expiredUrl: string | null;
  startsAt: string | null;
  maxClicks: number | null;
  disabled: boolean;
  archived: boolean;
  redirectType: number;
  forwardQuery: boolean;
  hideReferrer: boolean;
  cloaked: boolean;
  noLog: boolean;
  iosUrl: string | null;
  androidUrl: string | null;
  geoTargets: Record<string, string> | null;
  abVariants: Variant[] | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  publicStats: boolean;
  bioPinned: boolean;
  bioPosition: number;
  banned: boolean;
  bannedReason: string | null;
  status: LinkStatus;
  clickCount: number;
  lastClickedAt: string | null;
  tags: TagRef[];
  createdAt: string;
  updatedAt: string;
}

/** @deprecated kept for older imports; use LinkItem. */
export type LinkWithClicks = LinkItem;

export interface LinksResponse {
  links: LinkItem[];
  total: number;
  page: number;
  limit: number;
  pageSize: number;
  totalPages: number;
}

export interface Breakdown {
  key: string;
  clicks: number;
  uniques: number;
}

export interface StatsData {
  period: string;
  timezone: string;
  granularity: "hour" | "day" | "week" | "month";
  range: { since: string; until: string };
  totals: { clicks: number; uniques: number; bots: number; qrScans: number };
  previous: { clicks: number; uniques: number } | null;
  timeseries: Array<{ bucket: string; clicks: number; uniques: number; bots: number }>;
  referrers: Breakdown[];
  countries: Breakdown[];
  cities: Array<Breakdown & { country: string | null }>;
  devices: Breakdown[];
  browsers: Breakdown[];
  os: Breakdown[];
  languages: Breakdown[];
  sources: Breakdown[];
  destinations: Breakdown[];
  heatmap: Array<{ dow: number; hour: number; clicks: number }>;
  topLinks: Array<{
    id: string;
    shortCode: string;
    domain: string | null;
    title: string | null;
    originalUrl: string;
    clicks: number;
    uniques: number;
  }>;
  totalLinks?: number;
  activeLinks?: number;
}

export interface TagItem extends TagRef {
  linkCount: number;
  createdAt: string;
}

export interface ApiKeyItem {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  /** Only present in the create response. */
  key?: string;
}

export interface WebhookItem {
  id: string;
  url: string;
  secret: string;
  events: string[];
  enabled: boolean;
  lastStatus: number | null;
  lastError: string | null;
  lastTriggeredAt: string | null;
  createdAt: string;
}

export interface DomainItem {
  id: string;
  hostname: string;
  verified: boolean;
  verifiedAt: string | null;
  rootRedirect: string | null;
  notFoundRedirect: string | null;
  createdAt: string;
  linkCount: number;
  dns: {
    routing: { type: string; name: string; value: string };
    verification: { type: string; name: string; value: string };
  };
}

export interface AccountInfo {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: "USER" | "ADMIN";
  emailVerified: string | null;
  createdAt: string;
  hasPassword: boolean;
  providers: string[];
  counts: { links: number; tags: number; apiKeys: number; webhooks: number; domains: number };
}

export interface InstanceConfig {
  siteName: string;
  registrationEnabled: boolean;
  anonymousLinksEnabled: boolean;
  oauthProviders: string[];
  allowedDomains: string[];
  bulkLimit: number;
}

export interface BulkResult {
  index: number;
  ok: boolean;
  link?: LinkItem;
  error?: string;
}

export interface ClickEvent {
  id: string;
  timestamp: string;
  referrer: string | null;
  referrerHost: string | null;
  browser: string | null;
  os: string | null;
  device: string | null;
  country: string | null;
  city: string | null;
  source: string | null;
  isBot: boolean;
  link: {
    id: string;
    shortCode: string;
    domain: string | null;
    originalUrl: string;
    title: string | null;
  };
}
