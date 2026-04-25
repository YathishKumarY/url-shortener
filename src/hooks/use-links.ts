"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LinkWithClicks } from "@/types";

interface LinksResponse {
  links: LinkWithClicks[];
  total: number;
  page: number;
  pageSize: number;
}

async function extractApiError(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data.error === "string") return data.error;
    if (typeof data.error === "object" && data.error !== null) {
      const messages = Object.entries(data.error)
        .flatMap(([, msgs]) => (Array.isArray(msgs) ? msgs : [msgs]))
        .filter(Boolean);
      return (messages[0] as string) || fallback;
    }
    return fallback;
  } catch {
    return fallback;
  }
}

export function useLinks(page = 1, search = "") {
  return useQuery<LinksResponse>({
    queryKey: ["links", page, search],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: "10",
      });
      if (search) params.set("search", search);
      const res = await fetch(`/api/links?${params}`);
      if (!res.ok) {
        const msg = await extractApiError(res, "Failed to fetch links");
        throw new Error(msg);
      }
      return res.json();
    },
  });
}

export function useCreateLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { url: string; customAlias?: string; expiresAt?: string }) => {
      const res = await fetch("/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const msg = await extractApiError(res, "Failed to create link");
        throw new Error(msg);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["links"] });
    },
  });
}

export function useDeleteLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/links/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const msg = await extractApiError(res, "Failed to delete link");
        throw new Error(msg);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["links"] });
    },
  });
}

export function useLink(id: string) {
  return useQuery<LinkWithClicks>({
    queryKey: ["link", id],
    queryFn: async () => {
      const res = await fetch(`/api/links/${id}`);
      if (!res.ok) {
        const msg = await extractApiError(res, "Failed to fetch link");
        throw new Error(msg);
      }
      return res.json();
    },
    enabled: !!id,
  });
}

export function useUpdateLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string;
      customAlias?: string;
      expiresAt?: string | null;
      originalUrl?: string;
    }) => {
      const res = await fetch(`/api/links/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const msg = await extractApiError(res, "Failed to update link");
        throw new Error(msg);
      }
      return res.json();
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["links"] });
      queryClient.invalidateQueries({ queryKey: ["link", vars.id] });
    },
  });
}
