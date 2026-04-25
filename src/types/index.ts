export interface LinkWithClicks {
  id: string;
  shortCode: string;
  originalUrl: string;
  customAlias: string | null;
  expiresAt: string | null;
  clickCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface LinksResponse {
  links: LinkWithClicks[];
  total: number;
  page: number;
  limit: number;
}

export interface AnalyticsData {
  clicksOverTime: { date: string; clicks: number }[];
  topReferrers: { referrer: string; clicks: number }[];
  devices: { device: string; clicks: number }[];
  browsers: { browser: string; clicks: number }[];
  countries: { country: string; clicks: number }[];
  totalClicks: number;
  uniqueVisitors: number;
}

export type ClickAnalytics = AnalyticsData;
