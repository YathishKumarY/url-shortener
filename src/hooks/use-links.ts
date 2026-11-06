"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { BulkResult, LinkItem, LinksResponse } from "@/types";

export interface LinkFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  tag?: string;
  sort?: string;
  order?: "asc" | "desc";
}

/** Body accepted by POST /api/links and PATCH /api/links/:id. */
export type LinkPayload = Partial<{
  url: string;
  customAlias: string;
  emoji: boolean;
  domain: string | null;
  title: string | null;
  description: string | null;
  tags: string[];
  password: string | null;
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
  abVariants: Array<{ url: string; weight: number }> | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  publicStats: boolean;
  bioPinned: boolean;
}>;

function invalidateLinkQueries(queryClient: ReturnType<typeof useQueryClient>, id?: string) {
  queryClient.invalidateQueries({ queryKey: ["links"] });
  queryClient.invalidateQueries({ queryKey: ["stats"] });
  queryClient.invalidateQueries({ queryKey: ["tags"] });
  if (id) queryClient.invalidateQueries({ queryKey: ["link", id] });
}

export function useLinks(filters: LinkFilters = {}) {
  return useQuery<LinksResponse>({
    queryKey: ["links", filters],
    queryFn: () => {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== "" && value !== null) params.set(key, String(value));
      }
      return apiFetch<LinksResponse>(`/api/links?${params}`);
    },
    placeholderData: keepPreviousData,
  });
}

export function useLink(id: string) {
  return useQuery<LinkItem>({
    queryKey: ["link", id],
    queryFn: () => apiFetch<LinkItem>(`/api/links/${id}`),
    enabled: !!id,
  });
}

export function useCreateLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: LinkPayload & { url: string }) =>
      apiFetch<LinkItem>("/api/links", { method: "POST", json: data }),
    onSuccess: () => invalidateLinkQueries(queryClient),
  });
}

export function useUpdateLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: LinkPayload & { id: string }) =>
      apiFetch<LinkItem>(`/api/links/${id}`, { method: "PATCH", json: data }),
    onSuccess: (link) => {
      queryClient.setQueryData(["link", link.id], link);
      invalidateLinkQueries(queryClient, link.id);
    },
  });
}

export function useDeleteLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/api/links/${id}`, { method: "DELETE" }),
    onSuccess: () => invalidateLinkQueries(queryClient),
  });
}

export function useDuplicateLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<LinkItem>(`/api/links/${id}/duplicate`, { method: "POST" }),
    onSuccess: () => invalidateLinkQueries(queryClient),
  });
}

export function useBulkAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { ids: string[]; action: string; tag?: string }) =>
      apiFetch<{ action: string; affected: number }>("/api/links/bulk", {
        method: "PATCH",
        json: data,
      }),
    onSuccess: () => invalidateLinkQueries(queryClient),
  });
}

export interface BulkResponse {
  created: number;
  failed: number;
  results: BulkResult[];
}

export function useBulkCreate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      links: Array<{ url: string; customAlias?: string; title?: string }>;
      tags?: string[];
    }) => apiFetch<BulkResponse>("/api/links/bulk", { method: "POST", json: data }),
    onSettled: () => invalidateLinkQueries(queryClient),
  });
}

export function useImportLinks() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (csv: string) =>
      apiFetch<BulkResponse>("/api/links/import", { method: "POST", json: { csv } }),
    onSettled: () => invalidateLinkQueries(queryClient),
  });
}

export function useAliasCheck(alias: string, domain: string, enabled: boolean) {
  return useQuery<{ available: boolean; reason?: string }>({
    queryKey: ["alias", domain, alias],
    queryFn: () => apiFetch(`/api/links/check-alias?${new URLSearchParams({ alias, domain })}`),
    enabled: enabled && alias.trim().length > 0,
    staleTime: 10_000,
  });
}
