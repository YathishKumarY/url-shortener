"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type {
  AccountInfo,
  ApiKeyItem,
  DomainItem,
  InstanceConfig,
  TagItem,
  WebhookItem,
} from "@/types";

/* ---------------------------------------------------------------- config */

export function useInstanceConfig() {
  return useQuery<InstanceConfig>({
    queryKey: ["config"],
    queryFn: () => apiFetch("/api/config"),
    staleTime: 5 * 60_000,
  });
}

/* ------------------------------------------------------------------ tags */

export function useTags() {
  return useQuery<TagItem[]>({ queryKey: ["tags"], queryFn: () => apiFetch("/api/tags") });
}

export function useCreateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; color?: string }) =>
      apiFetch<TagItem>("/api/tags", { method: "POST", json: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tags"] }),
  });
}

export function useUpdateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; color?: string }) =>
      apiFetch<TagItem>(`/api/tags/${id}`, { method: "PATCH", json: data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tags"] });
      qc.invalidateQueries({ queryKey: ["links"] });
    },
  });
}

export function useDeleteTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/api/tags/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tags"] });
      qc.invalidateQueries({ queryKey: ["links"] });
    },
  });
}

/* -------------------------------------------------------------- api keys */

export function useApiKeys() {
  return useQuery<ApiKeyItem[]>({
    queryKey: ["api-keys"],
    queryFn: () => apiFetch("/api/api-keys"),
  });
}

export function useCreateApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; expiresInDays?: number | null }) =>
      apiFetch<ApiKeyItem>("/api/api-keys", { method: "POST", json: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["api-keys"] }),
  });
}

export function useDeleteApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/api/api-keys/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["api-keys"] }),
  });
}

/* -------------------------------------------------------------- webhooks */

export function useWebhooks() {
  return useQuery<WebhookItem[]>({
    queryKey: ["webhooks"],
    queryFn: () => apiFetch("/api/webhooks"),
  });
}

export function useCreateWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { url: string; events: string[] }) =>
      apiFetch<WebhookItem>("/api/webhooks", { method: "POST", json: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["webhooks"] }),
  });
}

export function useUpdateWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      url?: string;
      events?: string[];
      enabled?: boolean;
    }) => apiFetch<WebhookItem>(`/api/webhooks/${id}`, { method: "PATCH", json: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["webhooks"] }),
  });
}

export function useDeleteWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/api/webhooks/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["webhooks"] }),
  });
}

export function useTestWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ ok: boolean; status: number | null; error: string | null }>(
        `/api/webhooks/${id}/test`,
        { method: "POST" },
      ),
    onSettled: () => qc.invalidateQueries({ queryKey: ["webhooks"] }),
  });
}

/* --------------------------------------------------------------- domains */

export function useDomains() {
  return useQuery<DomainItem[]>({ queryKey: ["domains"], queryFn: () => apiFetch("/api/domains") });
}

export function useCreateDomain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (hostname: string) =>
      apiFetch<DomainItem>("/api/domains", { method: "POST", json: { hostname } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["domains"] }),
  });
}

export function useUpdateDomain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      rootRedirect?: string | null;
      notFoundRedirect?: string | null;
    }) => apiFetch<DomainItem>(`/api/domains/${id}`, { method: "PATCH", json: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["domains"] }),
  });
}

export function useVerifyDomain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ verified: boolean; message: string; domain: DomainItem }>(
        `/api/domains/${id}/verify`,
        { method: "POST" },
      ),
    onSettled: () => qc.invalidateQueries({ queryKey: ["domains"] }),
  });
}

export function useDeleteDomain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/api/domains/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["domains"] });
      qc.invalidateQueries({ queryKey: ["links"] });
    },
  });
}

/* --------------------------------------------------------------- account */

export function useAccount() {
  return useQuery<AccountInfo>({ queryKey: ["account"], queryFn: () => apiFetch("/api/account") });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name?: string; image?: string | null }) =>
      apiFetch("/api/account", { method: "PATCH", json: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["account"] }),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (data: { currentPassword?: string; newPassword: string }) =>
      apiFetch<{ message: string }>("/api/account/password", { method: "POST", json: data }),
  });
}

export function useDeleteAccount() {
  return useMutation({
    mutationFn: (confirmEmail: string) =>
      apiFetch<void>("/api/account", { method: "DELETE", json: { confirmEmail } }),
  });
}
