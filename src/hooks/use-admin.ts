"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { LinkItem } from "@/types";

/* ----------------------------------------------------------------- types */

export interface AdminStats {
  users: number;
  bannedUsers: number;
  newUsers24h: number;
  links: number;
  bannedLinks: number;
  anonymousLinks: number;
  clicks: number;
  clicks24h: number;
  openReports: number;
  timeseries: Array<{ bucket: string; clicks: number; uniques: number; bots: number }>;
  topLinks: Array<{
    id: string;
    shortCode: string;
    domain: string | null;
    title: string | null;
    originalUrl: string;
    clicks: number;
    uniques: number;
  }>;
  countries: Array<{ key: string; clicks: number; uniques: number }>;
}

export type AdminRole = "USER" | "ADMIN";

export interface AdminUser {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  role: AdminRole;
  bannedAt: string | null;
  createdAt: string;
  linkCount: number;
}

export interface AdminUsersResponse {
  users: AdminUser[];
  total: number;
  page: number;
  totalPages: number;
}

export type AdminLinkFilter = "all" | "reported" | "banned" | "anonymous";

export interface AdminLink extends LinkItem {
  owner: { id: string; email: string; name: string | null } | null;
  reportCount: number;
}

export interface AdminLinksResponse {
  links: AdminLink[];
  total: number;
  page: number;
  totalPages: number;
}

export type ReportReason = "phishing" | "malware" | "spam" | "illegal" | "other";

export interface AdminReport {
  id: string;
  linkId: string;
  reason: ReportReason;
  details: string | null;
  email: string | null;
  resolved: boolean;
  createdAt: string;
  link: {
    id: string;
    shortCode: string;
    domain: string | null;
    originalUrl: string;
    bannedAt: string | null;
    user: { email: string } | null;
    shortUrl: string;
  };
}

export interface BlockedDomain {
  id: string;
  domain: string;
  reason: string | null;
  createdAt: string;
}

/* ----------------------------------------------------------------- stats */

export function useAdminStats() {
  return useQuery<AdminStats>({
    queryKey: ["admin", "stats"],
    queryFn: () => apiFetch("/api/admin/stats"),
    staleTime: 30_000,
  });
}

/* ----------------------------------------------------------------- users */

export function useAdminUsers(search: string, page: number) {
  return useQuery<AdminUsersResponse>({
    queryKey: ["admin", "users", { search, page }],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page) });
      if (search) params.set("search", search);
      return apiFetch(`/api/admin/users?${params}`);
    },
    placeholderData: keepPreviousData,
  });
}

export function useUpdateAdminUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; role?: AdminRole; banned?: boolean }) =>
      apiFetch<AdminUser>(`/api/admin/users/${id}`, { method: "PATCH", json: data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      qc.invalidateQueries({ queryKey: ["admin", "stats"] });
    },
  });
}

export function useDeleteAdminUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/api/admin/users/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin"] });
    },
  });
}

/* ----------------------------------------------------------------- links */

export function useAdminLinks(search: string, filter: AdminLinkFilter, page: number) {
  return useQuery<AdminLinksResponse>({
    queryKey: ["admin", "links", { search, filter, page }],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page) });
      if (search) params.set("search", search);
      if (filter !== "all") params.set("filter", filter);
      return apiFetch(`/api/admin/links?${params}`);
    },
    placeholderData: keepPreviousData,
  });
}

function invalidateModeration(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["admin", "links"] });
  qc.invalidateQueries({ queryKey: ["admin", "reports"] });
  qc.invalidateQueries({ queryKey: ["admin", "stats"] });
}

export function useBanAdminLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, banned, reason }: { id: string; banned: boolean; reason?: string }) =>
      apiFetch<unknown>(`/api/admin/links/${id}`, { method: "PATCH", json: { banned, reason } }),
    onSuccess: () => invalidateModeration(qc),
  });
}

export function useDeleteAdminLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/api/admin/links/${id}`, { method: "DELETE" }),
    onSuccess: () => invalidateModeration(qc),
  });
}

/* --------------------------------------------------------------- reports */

export function useAdminReports(resolved: boolean) {
  return useQuery<AdminReport[]>({
    queryKey: ["admin", "reports", { resolved }],
    queryFn: () => apiFetch(`/api/admin/reports?resolved=${resolved}`),
  });
}

export function useResolveAdminReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, resolved }: { id: string; resolved: boolean }) =>
      apiFetch<unknown>(`/api/admin/reports/${id}`, { method: "PATCH", json: { resolved } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "reports"] });
      qc.invalidateQueries({ queryKey: ["admin", "links"] });
      qc.invalidateQueries({ queryKey: ["admin", "stats"] });
    },
  });
}

/* ------------------------------------------------------- blocked domains */

export function useBlockedDomains() {
  return useQuery<BlockedDomain[]>({
    queryKey: ["admin", "blocked-domains"],
    queryFn: () => apiFetch("/api/admin/blocked-domains"),
  });
}

export function useAddBlockedDomain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { domain: string; reason?: string }) =>
      apiFetch<BlockedDomain>("/api/admin/blocked-domains", { method: "POST", json: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "blocked-domains"] }),
  });
}

export function useDeleteBlockedDomain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/api/admin/blocked-domains/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "blocked-domains"] }),
  });
}
